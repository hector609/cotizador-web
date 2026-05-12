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

const MAX_MESSAGE_LEN = 2000;

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

export function ChatInterface() {
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
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
            Nueva cotización
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            Conversa con el asistente hasta tener todo. Genera el PDF oficial.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/cotizar-excel"
            className="text-xs sm:text-sm text-slate-600 hover:text-blue-700 underline underline-offset-2 whitespace-nowrap"
            title="Cotizar desde plantilla Excel"
          >
            Subir Excel →
          </Link>
          <button
            type="button"
            onClick={resetChat}
            className="text-xs sm:text-sm text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition"
            title="Reiniciar conversación"
          >
            Reiniciar
          </button>
        </div>
      </header>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-6"
        aria-live="polite"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {sending && <ThinkingIndicator />}

          {(job.kind === "polling" || job.kind === "starting") && (
            <JobCard job={job} onCancel={cancelJob} />
          )}

          {job.kind === "completed" && job.pdfUrl && (
            <CompletedCard pdfUrl={job.pdfUrl} onReset={resetChat} />
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
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LEN))}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={inputDisabled}
            rows={1}
            maxLength={MAX_MESSAGE_LEN}
            className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            aria-label="Mensaje al asistente"
          />
          <button
            type="submit"
            disabled={inputDisabled || draft.trim().length === 0}
            className="shrink-0 px-4 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Enviar mensaje"
          >
            {sending ? "…" : "Enviar"}
          </button>
        </div>
        {draft.length > MAX_MESSAGE_LEN - 100 && (
          <p className="max-w-3xl mx-auto mt-1 text-xs text-slate-400">
            {draft.length} / {MAX_MESSAGE_LEN}
          </p>
        )}
      </form>
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
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap break-words",
          isUser
            ? "bg-blue-700 text-white rounded-br-sm"
            : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm shadow-sm",
        ].join(" ")}
      >
        {message.text}
      </div>
    </div>
  );
}

function AgentAvatar() {
  return (
    <div
      aria-hidden="true"
      className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center text-xs font-bold shadow-sm"
    >
      AI
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-2 justify-start">
      <AgentAvatar />
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <span className="inline-flex gap-1" aria-label="El agente está pensando">
          <Dot delay={0} />
          <Dot delay={150} />
          <Dot delay={300} />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
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
  onReset,
}: {
  pdfUrl: string;
  onReset: () => void;
}) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-2xl px-5 py-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl shadow-sm"
        >
          PDF
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-slate-900">
            Tu cotización está lista
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Descarga el PDF oficial generado por el portal del operador.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
            >
              Descargar PDF
            </a>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
            >
              Empezar otra
            </button>
          </div>
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
