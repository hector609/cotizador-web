"use client";

/**
 * ChatInterface — UI conversacional para cotizar.
 *
 * REDISEÑO "REVENTAR mode" (dark glassmorphism premium tipo Linear/Vercel).
 * Bubbles con `backdrop-blur` sobre el shell `#0b1326`, glow cyan en el
 * timer y los focos importantes, gradiente blue→cyan para el usuario y los
 * CTAs primarios. Toda la lógica (hook `useChatCotizar`, JobCard polling,
 * handoff /optimizar) se mantiene 100% intacta — solo cambia presentación.
 *
 * Layout:
 *   - Topbar: breadcrumb "Inicio / Cotizar" + timer pill cyan + dropdown
 *     "Conversaciones recientes" (placeholder; no hay endpoint todavía).
 *   - Scroll area con bubbles glass (agente izquierda, usuario derecha).
 *   - Tarjetas especiales cuando hay job activo: JobCard (polling) o
 *     CompletedCard (inline) con folio mono cyan-300 + monto big.
 *   - Composer fijo abajo: textarea glass + botón gradient blue-cyan.
 *
 * Responsive: en móvil el composer queda fijo abajo del viewport; en desktop
 * la conversación ocupa hasta `max-w-3xl` centrada.
 *
 * Persistencia: el hook `useChatCotizar` guarda solo el `conversation_id` en
 * sessionStorage. Al refrescar la página el historial visible se pierde pero
 * el agente recuerda la conversación gracias a Claude conversation memory.
 */

import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useChatCotizar,
  type ChatMessage,
  type JobState,
  type PollingStage,
} from "@/lib/hooks/useChatCotizar";
import {
  ArrowUpTrayIcon,
  PaperAirplaneIcon,
  DocumentTextIcon,
  PhotoIcon,
  SparklesIcon,
} from "@/components/icons";

const MAX_MESSAGE_LEN = 2000;

/**
 * API expuesta a través del prop `onReady` para que el padre (e.g. el panel
 * de catálogo) pueda escribir al composer SIN auto-enviar. Solo `append` por
 * ahora — agregar más métodos requiere extender este contrato.
 */
export interface ChatInterfaceApi {
  /**
   * Inserta texto al final del draft del composer. Si el draft tiene
   * contenido, antepone newline para que cada copia quede en su propia
   * línea. Hace foco al textarea al final.
   */
  append: (text: string) => void;
}

interface ChatInterfaceProps {
  /**
   * Callback opcional invocado UNA VEZ al montar, recibiendo la API del
   * chat. Diseñado para que el panel de catálogo lateral pueda empujar
   * texto al composer (Copiar al chat) sin acoplar componentes.
   */
  onReady?: (api: ChatInterfaceApi) => void;
}

/**
 * Clave de sessionStorage que `/dashboard/optimizar` usa para pasarnos el
 * payload con las palancas óptimas (ver `OptimizarPage.handleAplicarYCotizar`).
 * Leemos UNA sola vez al montar y borramos la entrada para que un refresh
 * no vuelva a pre-llenar el composer.
 */
const OPTIMIZAR_STORAGE_KEY = "optimizar:palancas";

interface OptimizarHandoff {
  rfc?: string;
  lineas?: number;
  plan?: string;
  plazo?: number;
  equipo?: string;
  equipos_qty?: number;
  palancas?: {
    aportacion_voluntaria: number;
    meses_gratis: number;
    descuento_renta_pct: number;
    beneficio_megas_pct: number;
    tasa_negociada_pct: number;
  };
  rentabilidad_simulada?: number;
  razonamiento?: string;
  createdAt?: number;
}

/**
 * Construye el mensaje pre-llenado que el vendedor revisará antes de enviar.
 * Es deliberadamente verboso para que el agente del backend reciba todo el
 * contexto en un solo turno y empiece a cotizar de inmediato.
 */
function buildOptimizarPrompt(h: OptimizarHandoff): string {
  const partes: string[] = ["Cotiza con estas palancas aplicadas:"];
  if (h.rfc) partes.push(`- RFC: ${h.rfc}`);
  if (typeof h.lineas === "number") partes.push(`- Líneas: ${h.lineas}`);
  if (h.plan) partes.push(`- Plan: ${h.plan}`);
  if (typeof h.plazo === "number") partes.push(`- Plazo: ${h.plazo} meses`);
  if (h.equipo) {
    const qty =
      typeof h.equipos_qty === "number" ? ` (${h.equipos_qty} unidades)` : "";
    partes.push(`- Equipo: ${h.equipo}${qty}`);
  }
  const p = h.palancas;
  if (p) {
    partes.push("- Palancas:");
    partes.push(`  · Aportación voluntaria: $${p.aportacion_voluntaria.toLocaleString("es-MX")}`);
    partes.push(`  · Meses gratis: ${p.meses_gratis}`);
    partes.push(`  · Descuento renta: ${p.descuento_renta_pct}%`);
    partes.push(`  · Beneficio megas: ${p.beneficio_megas_pct}%`);
    partes.push(`  · Tasa negociada: ${p.tasa_negociada_pct}%`);
  }
  if (typeof h.rentabilidad_simulada === "number") {
    partes.push(
      `(Rentabilidad simulada: ${h.rentabilidad_simulada.toFixed(2)}%)`,
    );
  }
  return partes.join("\n");
}

export function ChatInterface({ onReady }: ChatInterfaceProps = {}) {
  const {
    messages,
    sending,
    job,
    rateLimitedFor,
    sendMessage,
    cancelJob,
    resetChat,
    inputDisabled,
  } = useChatCotizar();

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /**
   * Reloj global de la sesión (desde que se montó el chat). Es independiente
   * del reloj del job: aquí queremos que el vendedor vea cuánto lleva en la
   * conversación, no en la cotización específica. Cero costo si nadie mira.
   */
  const [sessionStart] = useState<number>(() => Date.now());
  const sessionElapsed = useElapsedSeconds(sessionStart, true);

  /**
   * Expone la API al padre una sola vez (StrictMode-safe: el ref `notified`
   * evita doble registro en doble-mount de desarrollo). El `setDraft` es
   * estable de React, y construimos `append` inline cada vez pero sólo
   * llamamos a `onReady` una vez — el padre guarda la función y nuestras
   * referencias internas (`setDraft`, `textareaRef`) son válidas durante
   * todo el ciclo de vida del componente, así no necesitamos re-publicar.
   */
  const apiPublishedRef = useRef(false);
  useEffect(() => {
    if (!onReady || apiPublishedRef.current) return;
    apiPublishedRef.current = true;
    onReady({
      append: (text: string) => {
        if (!text) return;
        setDraft((prev) => {
          const sep = prev.trim().length > 0 ? "\n" : "";
          const next = `${prev}${sep}${text}`;
          return next.slice(0, MAX_MESSAGE_LEN);
        });
        // Foco al textarea para que el siguiente Enter envíe.
        setTimeout(() => textareaRef.current?.focus(), 0);
      },
    });
  }, [onReady]);

  /**
   * Handoff desde /dashboard/optimizar: si el vendedor pulsó "Aplicar y
   * cotizar", lee las palancas de sessionStorage, arma un prompt verboso
   * y lo deja en el composer. NO auto-envía — el vendedor ve el texto y
   * presiona Enter cuando quiera. Esto cumple el contrato de Option A
   * del UX-audit sin riesgo de disparar una cotización accidental.
   *
   * Tanto la lectura de sessionStorage como el setState se difieren a un
   * micro-task con `queueMicrotask` para mantener la regla
   * `react-hooks/set-state-in-effect` (no llamar setState síncronamente
   * dentro del body del effect — evita cascada de renders).
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = window.sessionStorage.getItem(OPTIMIZAR_STORAGE_KEY);
        if (!raw) return;
        // Consumimos una sola vez (un refresh no debería re-pre-llenar).
        window.sessionStorage.removeItem(OPTIMIZAR_STORAGE_KEY);
        const handoff = JSON.parse(raw) as OptimizarHandoff;
        if (!handoff || typeof handoff !== "object") return;
        const prompt = buildOptimizarPrompt(handoff);
        if (prompt) {
          setDraft(prompt.slice(0, MAX_MESSAGE_LEN));
          // Foco al textarea para que Enter envíe inmediatamente.
          setTimeout(() => textareaRef.current?.focus(), 0);
        }
      } catch {
        // sessionStorage deshabilitado o JSON inválido: ignoramos.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll al final cuando llegan mensajes nuevos o cambia el estado.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, job.kind]);

  // Auto-resize del textarea (1-6 líneas).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [draft]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || inputDisabled) return;
    setDraft("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envía, Shift+Enter agrega nueva línea (estilo ChatGPT).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e as unknown as FormEvent);
    }
  };

  const placeholder = useMemo(() => {
    if (job.kind === "polling") return "Cotización en curso…";
    if (rateLimitedFor > 0) return `Espera ${rateLimitedFor}s…`;
    if (sending) return "Esperando respuesta…";
    return "Describe la cotización. Enter para enviar, Shift+Enter para nueva línea.";
  }, [job, rateLimitedFor, sending]);

  const sessionMins = Math.floor(sessionElapsed / 60);
  const sessionSecs = sessionElapsed % 60;
  const sessionHrs = Math.floor(sessionMins / 60);
  const sessionTimer = sessionHrs > 0
    ? `${sessionHrs.toString().padStart(2, "0")}:${(sessionMins % 60).toString().padStart(2, "0")}:${sessionSecs.toString().padStart(2, "0")}`
    : `00:${sessionMins.toString().padStart(2, "0")}:${sessionSecs.toString().padStart(2, "0")}`;

  const fillDraft = (text: string) => {
    setDraft((prev) => (prev.length > 0 ? prev : text));
    // Foco al textarea (defer al próximo frame para que el state nuevo aplique).
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) ta.focus();
    }, 0);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Topbar: breadcrumb + timer pill + dropdown conversaciones. Glassy
          sticky en la parte superior del pane. */}
      <header className="relative z-10 px-4 sm:px-8 py-4 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1326]/70 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <nav
            className="flex items-center gap-2 text-sm text-slate-400 min-w-0"
            aria-label="Migas de pan"
          >
            <Link
              href="/dashboard"
              className="hover:text-white transition truncate"
            >
              Inicio
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-white font-semibold truncate">Cotizar</span>
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Timer pill: tiempo desde inicio de sesión, glow cyan suave. */}
          <span
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono tabular-nums shadow-[0_0_18px_rgba(34,211,238,0.15)]"
            title="Tiempo desde inicio de la sesión"
            aria-label={`Tiempo de sesión ${sessionTimer}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" aria-hidden="true" />
            {sessionTimer}
            <span className="text-cyan-400/60">— desde inicio</span>
          </span>

          {/* Dropdown "Conversaciones recientes" (placeholder hasta que
              exista el endpoint). Mantiene UX previsible con <details>. */}
          <details className="relative">
            <summary
              className="list-none cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:border-cyan-400/40 transition"
              aria-label="Conversaciones recientes"
            >
              <span className="hidden sm:inline">Recientes</span>
              <ChevronDownIcon />
            </summary>
            <div
              className="absolute right-0 mt-2 w-64 rounded-xl bg-[#0b1326]/95 backdrop-blur-md border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)] p-3 z-40"
              role="menu"
            >
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                Conversaciones recientes
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aún no guardamos histórico de chats. Revisa{" "}
                <Link
                  href="/dashboard/historial"
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                >
                  Historial
                </Link>{" "}
                para ver tus cotizaciones generadas.
              </p>
            </div>
          </details>

          <button
            type="button"
            onClick={resetChat}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 transition shrink-0"
            title="Reiniciar conversación"
          >
            Reiniciar
          </button>
        </div>
      </header>

      {/* H1 + intro */}
      <div className="relative z-10 px-4 sm:px-8 pt-6 pb-2">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Nueva cotización
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-400">
            Conversa con el asistente hasta tener todo. Genera el PDF oficial
            en 3-5 minutos.
          </p>
        </div>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-8 py-6"
        aria-live="polite"
      >
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.length === 0 && !sending && job.kind === "idle" && (
            <ChatEmptyState />
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {sending && <ThinkingIndicator />}

          {(job.kind === "polling" || job.kind === "starting") && (
            <JobCard job={job} onCancel={cancelJob} />
          )}

          {job.kind === "completed" && (job.pdfUrl || job.screenshotUrl) && (
            <CompletedCard
              pdfUrl={job.pdfUrl}
              screenshotUrl={job.screenshotUrl}
              folio={job.id}
              onReset={resetChat}
            />
          )}

          {job.kind === "completed" && !job.pdfUrl && !job.screenshotUrl && (
            <SystemCard
              title="Cotización completada"
              body="No recibimos el enlace al PDF, pero la cotización está en tu Historial."
              actionLabel="Empezar otra"
              onAction={resetChat}
            />
          )}

          {job.kind === "failed" && job.timedOut && (
            <TelcelTimeoutCard
              message={job.message}
              onRetry={resetChat}
              rfc={job.rfc}
              jobId={job.id}
            />
          )}

          {job.kind === "failed" && !job.timedOut && (
            <SystemCard
              title="No se pudo completar"
              body={job.message}
              actionLabel="Empezar de nuevo"
              onAction={resetChat}
              variant="error"
            />
          )}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 border-t border-white/10 bg-[#0b1326]/80 backdrop-blur-md px-3 sm:px-8 py-4"
      >
        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl bg-slate-800/40 backdrop-blur-md border border-white/10 focus-within:border-cyan-400/40 focus-within:shadow-[0_0_24px_rgba(6,182,212,0.18)] transition p-2 flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LEN))}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={inputDisabled}
              rows={1}
              maxLength={MAX_MESSAGE_LEN}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Mensaje al asistente"
            />
            <div className="shrink-0 flex items-end gap-2 pb-1">
              <Link
                href="/dashboard/cotizar-excel"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition"
                title="Cotizar desde plantilla Excel"
                aria-label="Adjuntar Excel"
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
              </Link>
              <button
                type="submit"
                disabled={inputDisabled || draft.trim().length === 0}
                className="inline-flex items-center gap-2 px-5 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-bold border border-white/15 shadow-[0_0_24px_rgba(29,78,216,0.4)] hover:shadow-[0_0_32px_rgba(29,78,216,0.6)] hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100 transition"
                aria-label="Enviar mensaje"
              >
                <span className="hidden sm:inline">{sending ? "Enviando…" : "Enviar"}</span>
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick-actions chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/cotizar-excel"
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition"
            >
              Subir Excel
            </Link>
            <button
              type="button"
              onClick={() => fillDraft("Continúa con mi última cotización.")}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition"
            >
              Continuar última
            </button>
            <button
              type="button"
              onClick={() => fillDraft("Cotiza para un cliente de mi cartera: ")}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition"
            >
              Cliente cartera
            </button>
            <Link
              href="/dashboard/catalogos"
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition"
            >
              Catálogo planes
            </Link>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Enter para enviar · Shift+Enter para nueva línea</span>
            {draft.length > MAX_MESSAGE_LEN - 200 && (
              <span className="tabular-nums">
                {draft.length} / {MAX_MESSAGE_LEN}
              </span>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * Estado vacío del chat (sin mensajes aún). Reduce la "sábana negra" inicial
 * y le da al vendedor 3 ejemplos concretos de cómo arrancar — copy directo,
 * sin emojis (style-guide §5.1).
 */
function ChatEmptyState() {
  return (
    <div className="text-center py-10">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 mb-5 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
        <SparklesIcon className="w-7 h-7 text-white" />
      </div>
      <h2 className="text-xl font-bold text-white">
        Cuéntale al asistente qué necesitas cotizar
      </h2>
      <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
        RFC del cliente, número de líneas, plan y equipo si aplica. El
        asistente pregunta lo que falte y devuelve el PDF en 3-5 minutos.
      </p>
      <p className="mt-5 text-xs text-slate-500">
        Ejemplo:{" "}
        <span className="font-mono text-cyan-300/80">
          XAXX010101000, 25 líneas, plan EMPRESA 500, iPhone 15
        </span>
      </p>
    </div>
  );
}

/* ---------- Sub-componentes ---------- */

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] text-xs text-slate-400 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1.5">
          {message.text}
        </div>
      </div>
    );
  }
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <AgentAvatar />}
      <div
        className={[
          "max-w-[85%] sm:max-w-md xl:max-w-xl rounded-xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap break-words backdrop-blur",
          isUser
            ? "bg-gradient-to-br from-blue-700 to-blue-800 text-white border border-white/15 shadow-[0_0_18px_rgba(29,78,216,0.25)] rounded-tr-sm"
            : "bg-slate-800/60 border border-white/10 text-slate-100 rounded-tl-sm",
        ].join(" ")}
      >
        {message.text}
      </div>
      {isUser && <UserAvatar />}
    </div>
  );
}

function AgentAvatar() {
  return (
    <div
      aria-hidden="true"
      className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 border border-white/15 flex items-center justify-center shadow-[0_0_18px_rgba(6,182,212,0.35)]"
    >
      <SparklesIcon className="w-4 h-4 text-white" />
    </div>
  );
}

function UserAvatar() {
  // Avatar provisional con inicial estática "V" (vendedor). Si en el futuro
  // la sesión expone nombre/email, derivar la inicial.
  return (
    <div
      aria-hidden="true"
      className="shrink-0 w-9 h-9 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center text-xs font-bold text-slate-200"
    >
      V
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <AgentAvatar />
      <div className="bg-slate-800/60 backdrop-blur border border-white/10 rounded-xl rounded-tl-sm px-4 py-3 inline-flex items-center gap-2">
        <span className="inline-flex gap-1.5 items-center" aria-label="El agente está pensando">
          <Dot delay={0} />
          <Dot delay={200} />
          <Dot delay={400} />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  // animate-pulse es la única animación decorativa permitida por el
  // style-guide (§5.4 "solo en skeletons de loading"). Se usa aquí como
  // skeleton del próximo mensaje. animation-delay escalonado da el efecto
  // típico de "escribiendo…" sin recurrir a animate-bounce (prohibido).
  return (
    <span
      className="block w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)] animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

/**
 * Copy por fase del polling. Las strings son el corazón del fix de UX:
 * mientras Telcel tarda, le contamos al vendedor qué pasa para que no
 * piense que la app se congeló. La progresión está calibrada con los
 * tiempos observados (mediana 2-3 min, p95 4-5 min) y deja claro que en
 * la fase final (180s+) Telcel está mal, no nosotros.
 */
const STAGE_COPY: Record<
  PollingStage,
  { title: string; body: string; tone: "info" | "warn" }
> = {
  normal: {
    title: "Tu cotización está en marcha",
    body: "Telcel suele tardar 1-4 minutos. Puedes dejar esta pestaña abierta.",
    tone: "info",
  },
  slow: {
    title: "Trabajando con Telcel…",
    body: "Estamos verificando el plan y el equipo en el portal del operador.",
    tone: "info",
  },
  very_slow: {
    title: "Telcel está tardando más de lo normal",
    body: "Sigue corriendo. El portal a veces se pone lento en horas pico.",
    tone: "info",
  },
  warning: {
    title: "Telcel está lento hoy",
    body: "Vamos a esperar máximo 5 min. Puedes seguir trabajando en otra pestaña y te avisamos cuando llegue.",
    tone: "warn",
  },
};

function JobCard({ job, onCancel }: { job: JobState; onCancel: () => void }) {
  // Para `starting` aún no hay `startedAt`, así que lo capturamos al montar
  // el card. En `polling` usamos el `startedAt` real del hook. useState con
  // initializer evita llamar Date.now() durante render (regla
  // `react-hooks/purity` de React 19).
  const [fallbackStart] = useState<number>(() => Date.now());
  const startedAt = job.kind === "polling" ? job.startedAt : fallbackStart;
  const stage: PollingStage =
    job.kind === "polling" ? job.stage : "normal";
  const elapsed = useElapsedSeconds(
    startedAt,
    job.kind === "polling" || job.kind === "starting",
  );
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const copy = STAGE_COPY[stage];
  const isWarn = copy.tone === "warn";
  // Barra de progreso indicativa contra el cap de 5 min — útil sobre todo
  // en las fases tardías para que el vendedor SEPA que el timeout es real
  // y cuánto le queda.
  const POLL_CAP_S = 300;
  const pct = Math.min(100, Math.round((elapsed / POLL_CAP_S) * 100));

  const rfcLabel = job.kind === "polling" && job.rfc ? job.rfc : null;

  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl backdrop-blur-md border-2 p-5",
        isWarn
          ? "bg-amber-500/[0.08] border-amber-400/30 shadow-[0_0_30px_rgba(251,191,36,0.18)]"
          : "bg-slate-900/60 border-cyan-400/30 shadow-[0_0_30px_rgba(6,182,212,0.18)]",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border",
            isWarn
              ? "bg-amber-500/15 border-amber-400/30"
              : "bg-cyan-500/15 border-cyan-400/30 shadow-[0_0_18px_rgba(6,182,212,0.35)]",
          ].join(" ")}
        >
          <Spinner tone={isWarn ? "warn" : "info"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={[
                "text-sm font-bold",
                isWarn ? "text-amber-100" : "text-white",
              ].join(" ")}
            >
              {copy.title}
            </p>
            <span
              className={[
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase",
                isWarn
                  ? "bg-amber-400/15 text-amber-200 border-amber-400/30"
                  : "bg-cyan-400/15 text-cyan-200 border-cyan-400/30",
              ].join(" ")}
            >
              Cotizando contra Telcel
            </span>
          </div>
          <p
            className={[
              "text-xs mt-1 leading-relaxed",
              isWarn ? "text-amber-200/80" : "text-slate-400",
            ].join(" ")}
          >
            {copy.body}
          </p>

          {/* Dots typing — refuerzan que algo se está moviendo. */}
          <div className="mt-3 inline-flex items-center gap-2">
            <span className="inline-flex gap-1.5 items-center" aria-hidden="true">
              <Dot delay={0} />
              <Dot delay={200} />
              <Dot delay={400} />
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Cotizando contra Telcel… (~2 min)
            </span>
          </div>

          {/* Barra de progreso fina contra el cap de 5 min. */}
          <div
            className={[
              "mt-4 h-1.5 w-full rounded-full overflow-hidden",
              isWarn ? "bg-amber-500/20" : "bg-white/5",
            ].join(" ")}
            aria-hidden="true"
          >
            <div
              className={[
                "h-full transition-all duration-500 ease-out",
                isWarn
                  ? "bg-gradient-to-r from-amber-400 to-amber-500"
                  : "bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]",
              ].join(" ")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            className={[
              "text-[11px] mt-2 tabular-nums font-mono",
              isWarn ? "text-amber-200/70" : "text-slate-500",
            ].join(" ")}
          >
            Tiempo: {mins}:{secs.toString().padStart(2, "0")} / 5:00
            {rfcLabel ? ` · RFC ${rfcLabel}` : ""}
          </p>
        </div>
        {job.kind === "polling" && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 text-xs text-slate-400 hover:text-red-300 px-3 py-1.5 rounded-full hover:bg-red-500/10 border border-transparent hover:border-red-400/30 transition"
            aria-label="Cancelar la cotización en curso"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Card específico para timeout de Telcel (5 min sin respuesta). Es
 * distinto del SystemCard genérico porque ofrece acciones útiles:
 * reintentar (resetea el chat), reportar (abre mailto al soporte) e
 * ir al historial (la cotización puede seguir corriendo del lado del
 * operador y aparecer después).
 */
function TelcelTimeoutCard({
  message,
  onRetry,
  rfc,
  jobId,
}: {
  message: string;
  onRetry: () => void;
  rfc?: string;
  jobId?: string;
}) {
  const subject = encodeURIComponent("Telcel timeout — cotización web");
  const body = encodeURIComponent(
    [
      "Hola,",
      "",
      "La cotización en cotizador.hectoria.mx no completó después de 5 minutos.",
      rfc ? `RFC: ${rfc}` : null,
      jobId ? `Folio interno: ${jobId}` : null,
      `Hora: ${new Date().toLocaleString("es-MX")}`,
      "",
      "Adjunto contexto adicional aquí:",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const mailto = `mailto:soporte@hectoria.mx?subject=${subject}&body=${body}`;
  return (
    <div className="rounded-xl bg-red-500/[0.08] backdrop-blur-md border-2 border-red-400/30 shadow-[0_0_30px_rgba(248,113,113,0.18)] p-5">
      <p className="text-sm font-bold text-red-200">
        Telcel no respondió
      </p>
      <p className="text-xs text-red-200/80 mt-1 leading-relaxed">
        {message} Tu cotización podría seguir corriendo del lado del operador
        — revisa Historial en unos minutos.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-full bg-gradient-to-br from-red-600 to-red-700 text-white border border-white/15 shadow-[0_0_18px_rgba(248,113,113,0.4)] hover:scale-105 transition"
        >
          Reintentar
        </button>
        <Link
          href="/dashboard/historial"
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-white/20 transition"
        >
          Ver historial
        </Link>
        <a
          href={mailto}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:border-white/20 transition"
        >
          Reportar problema
        </a>
      </div>
    </div>
  );
}

function CompletedCard({
  pdfUrl,
  screenshotUrl,
  folio,
  onReset,
}: {
  /** PDF cliente del portal Telcel — undefined en cotizaciones BORRADOR. */
  pdfUrl?: string;
  /**
   * PNG con el resumen Telcel cuando el portal no emite PDF (borradores
   * sin RFC). Si está presente y pdfUrl no, renderizamos un thumbnail
   * clickable en lugar de los botones de PDF.
   */
  screenshotUrl?: string;
  folio: string;
  onReset: () => void;
}) {
  // Heurística para mostrar el PDF interno: el proxy del frontend acepta
  // `?formato=interno` y el job.id ya está validado por el regex de pdf/
  // route.ts. Si el bot no generó el PDF interno (no aplica al caso), el
  // proxy responderá 404 y el navegador mostrará una página de error
  // estándar. Aceptable: el botón sigue siendo opt-in.
  const isProxyPath = pdfUrl ? /^\/api\/cotizaciones\//.test(pdfUrl) : false;
  const pdfInternoUrl = isProxyPath
    ? `/api/cotizaciones/${encodeURIComponent(folio)}/pdf?formato=interno`
    : null;

  // Modo borrador: no hay PDF, solo captura. La distinción afecta CTAs +
  // copy. Validamos screenshotUrl con el mismo prefijo conocido del proxy
  // para no inyectar URLs arbitrarias en `<img>`.
  const isDraftMode = !pdfUrl && Boolean(screenshotUrl);
  const safeScreenshotUrl =
    screenshotUrl && /^\/api\/cotizaciones\/[A-Za-z0-9_-]{1,64}\/screenshot$/.test(screenshotUrl)
      ? screenshotUrl
      : undefined;

  // Folio cortito (mono, big). El job.id real puede ser un UUID — mostramos
  // primeros 8 chars upper para que quepa en el tipographic "big". El link
  // del PDF lleva el ID completo (no afecta navegación).
  const folioDisplay = folio.length > 12
    ? `#${folio.slice(0, 8).toUpperCase()}`
    : `#${folio.toUpperCase()}`;

  return (
    <div
      className="relative overflow-hidden rounded-xl bg-slate-900/70 backdrop-blur-md border-2 border-white/10 shadow-[0_0_30px_rgba(6,182,212,0.2)] p-6"
      role="status"
    >
      {/* Glow accent esquina */}
      <div
        aria-hidden="true"
        className="absolute right-0 top-0 w-48 h-48 bg-cyan-400/10 blur-3xl rounded-full"
      />

      <div className="relative">
        {/* Chip mint glow "COTIZACIÓN COMPLETADA" */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-widest shadow-[0_0_18px_rgba(45,212,191,0.35)]">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(45,212,191,0.8)]"
              aria-hidden="true"
            />
            Cotización completada
          </span>
        </div>

        {/* Folio big mono */}
        <p className="font-mono text-3xl md:text-4xl font-black text-cyan-300 tracking-tight tabular-nums">
          {folioDisplay}
        </p>
        <p className="mt-1 text-xs text-slate-500 font-mono break-all">
          Folio interno: {folio}
        </p>

        {/* Body: el desglose real (cliente/RFC/líneas/plazo/monto) no está
            todavía expuesto por el JobState — el hook solo recibe pdf_url.
            Mostramos el CTA principal con el copy del PDF y dejamos el
            chrome para cuando el endpoint enriquezca el payload.

            En modo BORRADOR (sin RFC) el portal no emite PDF; el bot guarda
            una captura PNG del resumen como evidencia. Renderizamos un
            thumbnail clickable en lugar de los botones de descarga. */}
        {isDraftMode ? (
          <>
            <p className="mt-5 text-sm text-slate-300 leading-relaxed max-w-2xl">
              Este es un <strong className="text-white">borrador sin RFC</strong>.
              El portal de Telcel no emite PDF oficial hasta capturar el
              cliente; te dejo la captura del resumen como evidencia.
            </p>

            {safeScreenshotUrl && (
              <div className="mt-6">
                <a
                  href={safeScreenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-xl overflow-hidden border border-white/15 bg-slate-900/50 hover:border-cyan-400/40 hover:shadow-[0_0_28px_rgba(6,182,212,0.35)] transition"
                  aria-label="Abrir captura del resumen en tamaño completo"
                  title="Abrir captura del resumen en tamaño completo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={safeScreenshotUrl}
                    alt="Captura del resumen de la cotización (borrador)"
                    className="block max-w-full sm:max-w-md w-auto h-auto max-h-72 object-contain"
                    loading="lazy"
                  />
                </a>
                <p className="mt-2 text-xs text-slate-500 italic">
                  Click para abrir la captura en tamaño completo.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-5 text-sm text-slate-300 leading-relaxed max-w-2xl">
              El PDF oficial fue generado por el portal de Telcel. Descarga el
              formato cliente para enviar, o el formato interno con el desglose
              de rentabilidad para tu equipo.
            </p>

            {/* Botones grandes: PDF Cliente (gradient) + PDF Interno (outline) */}
            <div className="mt-6 flex flex-wrap gap-3">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-bold border border-white/15 shadow-[0_0_24px_rgba(29,78,216,0.45)] hover:shadow-[0_0_32px_rgba(29,78,216,0.65)] hover:scale-105 transition"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  PDF Cliente
                </a>
              )}
              {pdfInternoUrl && (
                <a
                  href={pdfInternoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/15 text-slate-200 text-sm font-bold hover:border-cyan-400/40 hover:text-cyan-300 hover:bg-cyan-500/5 transition"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  PDF Interno
                </a>
              )}
              {safeScreenshotUrl && (
                <a
                  href={safeScreenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/15 text-slate-200 text-sm font-bold hover:border-cyan-400/40 hover:text-cyan-300 hover:bg-cyan-500/5 transition"
                >
                  <PhotoIcon className="w-4 h-4" />
                  Ver captura
                </a>
              )}
            </div>
          </>
        )}

        {/* Chips secundarias */}
        <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap gap-2">
          <Link
            href="/dashboard/optimizar"
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition"
          >
            Optimizar palancas
          </Link>
          <Link
            href="/dashboard/historial"
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition"
          >
            Ver en historial
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition"
          >
            Cotizar otra similar
          </button>
        </div>
      </div>
    </div>
  );
}

function SystemCard({
  title,
  body,
  actionLabel,
  onAction,
  variant = "info",
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  variant?: "info" | "error";
}) {
  const isError = variant === "error";
  return (
    <div
      className={[
        "rounded-xl backdrop-blur-md border p-5",
        isError
          ? "bg-red-500/[0.08] border-red-400/30 shadow-[0_0_24px_rgba(248,113,113,0.18)]"
          : "bg-slate-800/50 border-white/10",
      ].join(" ")}
    >
      <p
        className={[
          "text-sm font-bold",
          isError ? "text-red-200" : "text-white",
        ].join(" ")}
      >
        {title}
      </p>
      <p className={["text-xs mt-1 leading-relaxed", isError ? "text-red-200/80" : "text-slate-400"].join(" ")}>
        {body}
      </p>
      <button
        type="button"
        onClick={onAction}
        className={[
          "mt-4 inline-flex items-center px-4 py-2 text-sm font-bold rounded-full transition border",
          isError
            ? "bg-gradient-to-br from-red-600 to-red-700 text-white border-white/15 shadow-[0_0_18px_rgba(248,113,113,0.4)] hover:scale-105"
            : "bg-gradient-to-br from-blue-600 to-cyan-500 text-white border-white/15 shadow-[0_0_18px_rgba(29,78,216,0.4)] hover:scale-105",
        ].join(" ")}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function Spinner({ tone = "info" }: { tone?: "info" | "warn" }) {
  return (
    <svg
      className={[
        "animate-spin h-6 w-6",
        tone === "warn" ? "text-amber-300" : "text-cyan-300",
      ].join(" ")}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Reloj reactivo en segundos desde `startedAt` mientras `active` sea true. */
function useElapsedSeconds(startedAt: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [active]);
  return Math.max(0, Math.floor((now - startedAt) / 1_000));
}
