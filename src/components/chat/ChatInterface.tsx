"use client";

/**
 * ChatInterface — UI conversacional para cotizar.
 *
 * Layout:
 *   - Header con título + acciones secundarias (Subir Excel, Reiniciar).
 *   - Scroll area con mensajes (agente izquierda, usuario derecha).
 *   - Tarjetas especiales cuando hay job activo: "Cotizando..." con tiempo
 *     transcurrido y botón Cancelar, o "Cotización lista" con link al PDF.
 *   - Composer fijo abajo: textarea autoexpansible + botón Enviar.
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
    return "Escribe tu solicitud. Enter para enviar, Shift+Enter para nueva línea.";
  }, [job, rateLimitedFor, sending]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
      {/* Header del chat — H1 propio (audit A1: cada página dashboard debe
          tener H1). El topbar global ya está montado por el padre. */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Nueva cotización
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 hidden sm:block">
            Conversa con el asistente hasta tener todo. Genera el PDF oficial.
          </p>
        </div>
        <button
          type="button"
          onClick={resetChat}
          className="text-xs sm:text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100 transition shrink-0"
          title="Reiniciar conversación"
        >
          Reiniciar
        </button>
      </header>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-6"
        aria-live="polite"
      >
        <div className="max-w-3xl mx-auto space-y-4">
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

          {job.kind === "completed" && job.pdfUrl && (
            <CompletedCard
              pdfUrl={job.pdfUrl}
              folio={job.id}
              onReset={resetChat}
            />
          )}

          {job.kind === "completed" && !job.pdfUrl && (
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
        className="bg-white border-t border-slate-200 px-3 sm:px-6 py-3"
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <Link
              href="/dashboard/cotizar-excel"
              className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 text-slate-600 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-50 transition"
              title="Cotizar desde plantilla Excel"
              aria-label="Adjuntar Excel"
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
            </Link>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LEN))}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={inputDisabled}
              rows={1}
              maxLength={MAX_MESSAGE_LEN}
              className="flex-1 resize-none rounded-lg border border-slate-300 px-4 py-2.5 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              aria-label="Mensaje al asistente"
            />
            <button
              type="submit"
              disabled={inputDisabled || draft.trim().length === 0}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 h-10 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md"
              aria-label="Enviar mensaje"
            >
              <span className="hidden sm:inline">{sending ? "…" : "Enviar"}</span>
              <PaperAirplaneIcon className="w-4 h-4 sm:hidden" />
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
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
 * Estado vacío del chat (sin mensajes aún). Reduce la "sábana blanca" inicial
 * y le da al vendedor 3 ejemplos concretos de cómo arrancar — copy directo,
 * sin emojis (style-guide §5.1).
 */
function ChatEmptyState() {
  return (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-4">
        <DocumentTextIcon className="w-6 h-6 text-blue-700" />
      </div>
      <h2 className="text-base font-semibold text-slate-900">
        Cuéntale al asistente qué necesitas cotizar
      </h2>
      <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
        RFC del cliente, número de líneas, plan y equipo si aplica. El
        asistente pregunta lo que falte y devuelve el PDF en 3-5 minutos.
      </p>
      <p className="mt-4 text-xs text-slate-500">
        Ejemplo: <span className="font-mono text-slate-700">XAXX010101000, 25 líneas, plan EMPRESA 500, iPhone 15</span>
      </p>
    </div>
  );
}

/* ---------- Sub-componentes ---------- */

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] text-xs text-slate-500 bg-slate-100 rounded-full px-3 py-1.5">
          {message.text}
        </div>
      </div>
    );
  }
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <AgentAvatar />}
      <div
        className={[
          "max-w-[85%] sm:max-w-md rounded-2xl px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap break-words",
          isUser
            ? "bg-blue-700 text-white rounded-br-sm"
            : "bg-slate-50 border border-slate-200 text-slate-900 rounded-bl-sm",
        ].join(" ")}
      >
        {message.text}
      </div>
    </div>
  );
}

function AgentAvatar() {
  // Avatar plano (style-guide §5.2 prohíbe gradientes saturados/multi-stop
  // y §5.5 prohíbe sombras de color). Mantenemos blue-100/blue-700 — mismo
  // sistema que badges primary y el dot de RecienteRow.
  return (
    <div
      aria-hidden="true"
      className="shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold"
    >
      AI
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-2 justify-start">
      <AgentAvatar />
      <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
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
      className="block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"
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
  return (
    <div
      className={[
        "rounded-2xl px-5 py-4 shadow-sm border",
        isWarn
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-blue-200",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
            isWarn ? "bg-amber-100" : "bg-blue-100",
          ].join(" ")}
        >
          <Spinner tone={isWarn ? "warn" : "info"} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={[
              "text-sm font-semibold",
              isWarn ? "text-amber-900" : "text-slate-900",
            ].join(" ")}
          >
            {copy.title}
          </p>
          <p
            className={[
              "text-xs mt-0.5",
              isWarn ? "text-amber-800" : "text-slate-600",
            ].join(" ")}
          >
            {copy.body}
          </p>
          {/* Barra de progreso fina contra el cap de 5 min. */}
          <div
            className={[
              "mt-3 h-1.5 w-full rounded-full overflow-hidden",
              isWarn ? "bg-amber-200/70" : "bg-blue-100",
            ].join(" ")}
            aria-hidden="true"
          >
            <div
              className={[
                "h-full transition-all duration-500 ease-out",
                isWarn ? "bg-amber-500" : "bg-blue-600",
              ].join(" ")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            className={[
              "text-xs mt-2 tabular-nums",
              isWarn ? "text-amber-700" : "text-slate-400",
            ].join(" ")}
          >
            Tiempo: {mins}:{secs.toString().padStart(2, "0")} / 5:00
            {job.kind === "polling" && job.rfc ? ` · RFC ${job.rfc}` : ""}
          </p>
        </div>
        {job.kind === "polling" && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 text-xs text-slate-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition"
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
    <div className="rounded-2xl px-5 py-4 shadow-sm border bg-red-50 border-red-200">
      <p className="text-sm font-semibold text-red-900">
        Telcel no respondió
      </p>
      <p className="text-xs text-red-800 mt-1">
        {message} Tu cotización podría seguir corriendo del lado del operador
        — revisa Historial en unos minutos.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-lg bg-red-700 text-white hover:bg-red-800 transition"
        >
          Reintentar
        </button>
        <Link
          href="/dashboard/historial"
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-red-300 text-red-800 hover:bg-red-100 transition"
        >
          Ver historial
        </Link>
        <a
          href={mailto}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
        >
          Reportar problema
        </a>
      </div>
    </div>
  );
}

function CompletedCard({
  pdfUrl,
  folio,
  onReset,
}: {
  pdfUrl: string;
  folio: string;
  onReset: () => void;
}) {
  // Heurística para mostrar el PDF interno: el proxy del frontend acepta
  // `?formato=interno` y el job.id ya está validado por el regex de pdf/
  // route.ts. Si el bot no generó el PDF interno (no aplica al caso), el
  // proxy responderá 404 y el navegador mostrará una página de error
  // estándar. Aceptable: el botón sigue siendo opt-in.
  const isProxyPath = /^\/api\/cotizaciones\//.test(pdfUrl);
  const pdfInternoUrl = isProxyPath
    ? `/api/cotizaciones/${encodeURIComponent(folio)}/pdf?formato=interno`
    : null;

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      role="status"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Cotización lista
          </p>
          <p className="mt-2 font-mono text-sm text-slate-900">
            Folio {folio}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <span
            className="w-1.5 h-1.5 rounded-full bg-green-600"
            aria-hidden="true"
          />
          Generada por Telcel
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-600 leading-relaxed">
        Descarga el PDF oficial generado por el portal del operador. El interno
        incluye el desglose de rentabilidad para tu equipo.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition shadow-md"
        >
          <DocumentTextIcon className="w-4 h-4" />
          PDF Cliente
        </a>
        {pdfInternoUrl && (
          <a
            href={pdfInternoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
          >
            <DocumentTextIcon className="w-4 h-4" />
            PDF Interno
          </a>
        )}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
        >
          Empezar otra
        </button>
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
        "rounded-2xl px-5 py-4 shadow-sm border",
        isError
          ? "bg-red-50 border-red-200"
          : "bg-white border-slate-200",
      ].join(" ")}
    >
      <p
        className={[
          "text-sm font-semibold",
          isError ? "text-red-900" : "text-slate-900",
        ].join(" ")}
      >
        {title}
      </p>
      <p className={["text-xs mt-1", isError ? "text-red-700" : "text-slate-600"].join(" ")}>
        {body}
      </p>
      <button
        type="button"
        onClick={onAction}
        className={[
          "mt-3 inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition",
          isError
            ? "bg-red-700 text-white hover:bg-red-800"
            : "bg-slate-900 text-white hover:bg-slate-700",
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
        "animate-spin h-5 w-5",
        tone === "warn" ? "text-amber-700" : "text-blue-700",
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
