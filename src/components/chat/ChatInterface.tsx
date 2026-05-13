"use client";

/**
 * ChatInterface — UI conversacional para cotizar.
 *
 * REDISEÑO LUMINA Light Premium (pivot 2026-05-13). Pivot total desde el dark
 * "REVENTAR mode" anterior. Base literal: 21st `Animated AI Chat` (typing
 * dots stagger, AnimatePresence, motion fade-up bubbles, auto-resize textarea
 * con useAutoResizeTextarea, focus-ring suave). Color tokens adaptados a
 * LUMINA:
 *   - Surfaces: bg-white sobre bg-slate-50.
 *   - Primary gradient: indigo-600 → cyan-500.
 *   - Borders: slate-200.
 *   - Text: slate-900 (titles) / slate-600 (body) / slate-500 (hints).
 *   - Cero `bg-[#0b1326]`, cero glass-dark.
 *
 * Toda la lógica (hook `useChatCotizar`, JobCard polling, handoff
 * /optimizar, ChatInterfaceApi.append, sessionStorage drain) se mantiene
 * 100% intacta — solo cambia presentación.
 *
 * Layout:
 *   - Topbar bg-white sticky: breadcrumb + timer pill cyan glow + dropdown
 *     "Recientes" + botón Reiniciar.
 *   - Scroll vertical con max-w-3xl, padding generoso. Bubbles motion fade-up.
 *   - Composer fixed abajo: textarea auto-resize + clip ghost + send pill
 *     gradient con focus-ring indigo-100.
 *   - Quick-action chips bajo el composer.
 *
 * Cuando llega la cotización: `CompletedCard` inline con NumberFlow para el
 * monto, gradient indigo→cyan buttons, mint chip "COMPLETADA" pulsing.
 */

import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { Paperclip, Sparkles, SendHorizonal, BookOpen, X } from "lucide-react";
import {
  useChatCotizar,
  type ChatMessage,
  type JobState,
  type PollingStage,
} from "@/lib/hooks/useChatCotizar";
import {
  useAriaCoPilot,
  type AriaSuggestion,
} from "@/lib/hooks/useAriaCoPilot";
import { AriaCoPilot } from "./AriaCoPilot";
import { DocumentTextIcon, PhotoIcon } from "@/components/icons";

const MAX_MESSAGE_LEN = 2000;

/**
 * API expuesta a través del prop `onReady` para que el padre (e.g. el panel
 * de catálogo) pueda escribir al composer SIN auto-enviar.
 */
export interface ChatInterfaceApi {
  append: (text: string) => void;
}

interface ChatInterfaceProps {
  onReady?: (api: ChatInterfaceApi) => void;
  /**
   * Estado del drawer del catálogo Telcel (controlado por `CotizarLayout`).
   * Cuando es `true`, el toggle del topbar muestra el chip "cerrar".
   */
  catalogoOpen?: boolean;
  /**
   * Callback que alterna la visibilidad del drawer del catálogo Telcel.
   * Si no se pasa, el toggle no se renderiza (modo standalone).
   */
  onToggleCatalogo?: () => void;
}

/**
 * sessionStorage key que `/dashboard/optimizar` usa para pasarnos las palancas.
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
    partes.push(`(Rentabilidad simulada: ${h.rentabilidad_simulada.toFixed(2)}%)`);
  }
  return partes.join("\n");
}

/**
 * useAutoResizeTextarea — replica del hook de 21st "Animated AI Chat".
 * Mide `scrollHeight` cada vez que cambia el value y aplica directly al
 * inline style del textarea. Caps a `maxHeight` para evitar que el composer
 * coma toda la pantalla.
 */
function useAutoResizeTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  { minHeight = 48, maxHeight = 180 }: { minHeight?: number; maxHeight?: number } = {},
) {
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(Math.max(ta.scrollHeight, minHeight), maxHeight);
    ta.style.height = `${next}px`;
  }, [ref, value, minHeight, maxHeight]);
}

export function ChatInterface({
  onReady,
  catalogoOpen = false,
  onToggleCatalogo,
}: ChatInterfaceProps = {}) {
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

  useAutoResizeTextarea(textareaRef, draft);

  // --- Aria CoPilot state (side-panel) ---
  // Aria observa el state del chat sin tocar el hook useChatCotizar. Aquí
  // hacemos un parse defensivo del draft para extraer RFC/plan/tramite/plazo
  // sin esperar a que el backend nos los devuelva. Si el campo aparece en el
  // draft Aria puede reaccionar EN VIVO mientras el vendedor escribe; si no,
  // confiamos en el resultado del agente cuando llegue.
  const [ariaOpen, setAriaOpen] = useState(false);
  // ms del último cambio en el draft — para detectar idle de 3min.
  const [draftLastChangeAt, setDraftLastChangeAt] = useState<number>(() =>
    Date.now(),
  );
  const [idleMs, setIdleMs] = useState(0);

  // Reloj de idle: refresca cada 30s. Solo "tiquea" mientras hay draft no
  // enviado, para no malgastar cómputo cuando el composer está vacío o se
  // completó una cotización.
  useEffect(() => {
    if (draft.trim().length === 0) {
      setIdleMs(0);
      return;
    }
    const tick = () => setIdleMs(Date.now() - draftLastChangeAt);
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [draft, draftLastChangeAt]);

  // Snapshot del estado actual para Aria. Parseo defensivo del draft —
  // best-effort, NO bloquea el flow si falla.
  const ariaSnapshot = useMemo(() => {
    const text = draft.toUpperCase();
    const rfcMatch = text.match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/);
    const plazoMatch = text.match(/(\d{1,2})\s*MESES?/);
    let tramite: string | undefined;
    if (/CAMBIO\s*PLAN/.test(text)) tramite = "CAMBIO PLAN";
    else if (/RENOVACION/.test(text)) tramite = "RENOVACION";
    else if (/ACTIVACION/.test(text)) tramite = "ACTIVACION";
    let plan: string | undefined;
    const planMatch = text.match(/PLAN\s+([A-Z0-9 ]{3,40})/);
    if (planMatch) plan = planMatch[1].trim().split(/\s{2,}|,|\./)[0].slice(0, 50);
    if (/VPN/.test(text) && !plan) plan = "VPN";

    // lastABResult: intentamos extraerlo de la última respuesta del agente
    // que mencione "A/B X%" o "rentabilidad X%". Si no la encontramos, null.
    let lastAB: number | null = null;
    if (job.kind === "completed") {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role !== "agent") continue;
        const abMatch =
          m.text.match(/A\/B[^\d]{0,8}(\d{1,3}(?:[.,]\d+)?)\s*%/i) ||
          m.text.match(/rentabilidad[^\d]{0,12}(\d{1,3}(?:[.,]\d+)?)\s*%/i);
        if (abMatch) {
          const v = Number(abMatch[1].replace(",", "."));
          if (Number.isFinite(v) && v >= 0 && v <= 100) lastAB = v;
          break;
        }
      }
    }

    return {
      rfc: rfcMatch ? rfcMatch[0] : undefined,
      plan,
      tramite,
      plazo: plazoMatch ? Number(plazoMatch[1]) : undefined,
      draft,
      lastABResult: lastAB,
      idleMs,
    };
  }, [draft, idleMs, job.kind, messages]);

  // Handler de "apply" — el callback_id define cómo mutar el draft o navegar.
  // NO toca useChatCotizar; solo manipulamos `draft` vía setDraft.
  const handleAriaApply = useCallback((s: AriaSuggestion) => {
    if (!s.action) return;
    const { callback_id, params = {} } = s.action;
    if (callback_id === "set_tramite") {
      const nuevo = String(params.tramite || "").trim();
      if (!nuevo) return;
      setDraft((prev) => {
        // Reemplaza el trámite existente o agrega línea nueva.
        const upper = prev.toUpperCase();
        if (
          /ACTIVACION|RENOVACION|CAMBIO\s*PLAN/.test(upper)
        ) {
          return prev.replace(
            /ACTIVACION|RENOVACION|CAMBIO\s*PLAN/gi,
            nuevo,
          );
        }
        const sep = prev.trim().length > 0 ? "\n" : "";
        return `${prev}${sep}Trámite: ${nuevo}`.slice(0, MAX_MESSAGE_LEN);
      });
      setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }
    if (callback_id === "compose_template") {
      const tpl =
        typeof params.text === "string"
          ? params.text
          : "RFC: \nLíneas: \nPlan: \nEquipo: ";
      setDraft((prev) => (prev.trim().length > 0 ? prev : tpl).slice(0, MAX_MESSAGE_LEN));
      setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }
    if (callback_id === "compose_multiperfil") {
      const extra = Number(params.lineas_extra) || 2;
      setDraft((prev) => {
        const sep = prev.trim().length > 0 ? "\n" : "";
        return `${prev}${sep}Agrega ${extra} líneas adicionales para mejorar rentabilidad (multi-perfil).`.slice(
          0,
          MAX_MESSAGE_LEN,
        );
      });
      setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }
    if (callback_id === "navigate" && typeof params.path === "string") {
      window.location.href = params.path;
      return;
    }
    if (callback_id === "apply_palanca") {
      // Re-emitimos a /optimizar con los params como sessionStorage handoff
      // inverso. El owner ya tiene flujo desde /optimizar → /cotizar; aquí
      // solo navegamos.
      window.location.href = "/dashboard/optimizar";
      return;
    }
  }, []);

  const aria = useAriaCoPilot(ariaSnapshot, handleAriaApply);

  // Auto-abre Aria cuando llega una sugerencia de alta prioridad y el panel
  // está colapsado. NO se reabre si el usuario la cerró manualmente para el
  // mismo set de sugerencias (rastreamos `lastAutoOpenedKey`).
  const lastAutoOpenedKeyRef = useRef<string>("");
  useEffect(() => {
    if (aria.suggestions.length === 0) return;
    const hasHighPriority = aria.suggestions.some(
      (s) => s.level === "warn" || s.level === "action",
    );
    if (!hasHighPriority) return;
    const key = aria.suggestions.map((s) => s.id).join("|");
    if (key === lastAutoOpenedKeyRef.current) return;
    lastAutoOpenedKeyRef.current = key;
    setAriaOpen(true);
  }, [aria.suggestions]);

  // Reloj global de la sesión.
  const [sessionStart] = useState<number>(() => Date.now());
  const sessionElapsed = useElapsedSeconds(sessionStart, true);

  // Expone API al padre una sola vez (StrictMode-safe).
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
        setTimeout(() => textareaRef.current?.focus(), 0);
      },
    });
  }, [onReady]);

  // Handoff desde /dashboard/optimizar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = window.sessionStorage.getItem(OPTIMIZAR_STORAGE_KEY);
        if (!raw) return;
        window.sessionStorage.removeItem(OPTIMIZAR_STORAGE_KEY);
        const handoff = JSON.parse(raw) as OptimizarHandoff;
        if (!handoff || typeof handoff !== "object") return;
        const prompt = buildOptimizarPrompt(handoff);
        if (prompt) {
          setDraft(prompt.slice(0, MAX_MESSAGE_LEN));
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

  // Auto-scroll al final.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, job.kind]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || inputDisabled) return;
      setDraft("");
      await sendMessage(text);
    },
    [draft, inputDisabled, sendMessage],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Topbar light sticky */}
      <header className="relative z-10 px-4 sm:px-8 py-4 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <nav
            className="flex items-center gap-2 text-sm text-slate-500 min-w-0"
            aria-label="Migas de pan"
          >
            <Link
              href="/dashboard"
              className="hover:text-slate-900 transition truncate"
            >
              Inicio
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-slate-900 font-semibold truncate">Cotizar</span>
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle del drawer del catálogo Telcel. Pill light por default;
              chip indigo cuando el drawer está abierto. */}
          {onToggleCatalogo && (
            <button
              type="button"
              onClick={onToggleCatalogo}
              aria-label={
                catalogoOpen
                  ? "Cerrar catálogo Telcel"
                  : "Abrir catálogo Telcel"
              }
              aria-expanded={catalogoOpen}
              aria-controls="catalogo-drawer-title"
              className={[
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                catalogoOpen
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                  : "bg-white border-slate-200 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50",
              ].join(" ")}
            >
              {catalogoOpen ? (
                <X className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
              ) : (
                <BookOpen
                  className="w-4 h-4"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              )}
              <span className="hidden sm:inline">Catálogo Telcel</span>
            </button>
          )}

          {/* Timer pill cyan glow (decorativo). */}
          <span
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-mono tabular-nums shadow-sm"
            title="Tiempo desde inicio de la sesión"
            aria-label={`Tiempo de sesión ${sessionTimer}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.7)]"
              aria-hidden="true"
            />
            {sessionTimer}
            <span className="text-cyan-500/70">— desde inicio</span>
          </span>

          {/* Dropdown "Conversaciones recientes" (placeholder). */}
          <details className="relative">
            <summary
              className="list-none cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:border-indigo-300 hover:bg-indigo-50/40 transition"
              aria-label="Conversaciones recientes"
            >
              <span className="hidden sm:inline">Recientes</span>
              <ChevronDownIcon />
            </summary>
            <div
              className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-200/60 p-3 z-40"
              role="menu"
            >
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                Conversaciones recientes
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Aún no guardamos histórico de chats. Revisa{" "}
                <Link
                  href="/dashboard/historial"
                  className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2 font-medium"
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
            className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-full hover:bg-slate-100 border border-transparent hover:border-slate-200 transition shrink-0"
            title="Reiniciar conversación"
          >
            Reiniciar
          </button>
        </div>
      </header>

      {/* H1 + intro */}
      <div className="relative z-10 px-4 sm:px-8 pt-6 pb-2">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Nueva cotización
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">
            Conversa con el asistente hasta tener todo. Genera el PDF oficial
            en 3-5 minutos.
          </p>
        </div>
      </div>

      {/* Mensajes con AnimatePresence para enter/exit motion */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-8 py-6"
        aria-live="polite"
      >
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.length === 0 && !sending && job.kind === "idle" && (
            <ChatEmptyState />
          )}

          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {sending && <ThinkingIndicator key="__thinking__" />}

            {(job.kind === "polling" || job.kind === "starting") && (
              <motion.div
                key="__jobcard__"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <JobCard job={job} onCancel={cancelJob} />
              </motion.div>
            )}

            {job.kind === "completed" &&
              (job.pdfUrl || job.screenshotUrl) && (
                <motion.div
                  key="__completed__"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                >
                  <CompletedCard
                    pdfUrl={job.pdfUrl}
                    screenshotUrl={job.screenshotUrl}
                    folio={job.id}
                    onReset={resetChat}
                  />
                </motion.div>
              )}

            {job.kind === "completed" &&
              !job.pdfUrl &&
              !job.screenshotUrl && (
                <SystemCard
                  key="__completed-noresult__"
                  title="Cotización completada"
                  body="No recibimos el enlace al PDF, pero la cotización está en tu Historial."
                  actionLabel="Empezar otra"
                  onAction={resetChat}
                />
              )}

            {job.kind === "failed" && job.timedOut && (
              <TelcelTimeoutCard
                key="__timeout__"
                message={job.message}
                onRetry={resetChat}
                rfc={job.rfc}
                jobId={job.id}
              />
            )}

            {job.kind === "failed" && !job.timedOut && (
              <SystemCard
                key="__failed__"
                title="No se pudo completar"
                body={job.message}
                actionLabel="Empezar de nuevo"
                onAction={resetChat}
                variant="error"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Composer light */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 border-t border-slate-200 bg-white/85 backdrop-blur-md px-3 sm:px-8 py-4"
      >
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-white border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition px-2 py-2 flex items-end gap-2 shadow-sm">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value.slice(0, MAX_MESSAGE_LEN));
                setDraftLastChangeAt(Date.now());
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={inputDisabled}
              rows={1}
              maxLength={MAX_MESSAGE_LEN}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Mensaje al asistente"
            />
            <div className="shrink-0 flex items-end gap-2 pb-1">
              <Link
                href="/dashboard/cotizar-excel"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition"
                title="Cotizar desde plantilla Excel"
                aria-label="Adjuntar Excel"
              >
                <Paperclip className="w-5 h-5" strokeWidth={1.8} />
              </Link>
              <motion.button
                type="submit"
                disabled={inputDisabled || draft.trim().length === 0}
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.04 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="inline-flex items-center gap-2 px-5 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 text-white text-sm font-bold border border-white/20 shadow-md shadow-indigo-300/40 hover:shadow-indigo-400/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition"
                aria-label="Enviar mensaje"
              >
                <span className="hidden sm:inline">{sending ? "Enviando…" : "Enviar"}</span>
                <SendHorizonal className="w-4 h-4" strokeWidth={2} />
              </motion.button>
            </div>
          </div>

          {/* Quick-action chips light */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/cotizar-excel"
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition"
            >
              Subir Excel
            </Link>
            <button
              type="button"
              onClick={() => fillDraft("Continúa con mi última cotización.")}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition"
            >
              Continuar última
            </button>
            <button
              type="button"
              onClick={() => fillDraft("Cotiza para un cliente de mi cartera: ")}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition"
            >
              Cliente cartera
            </button>
            <Link
              href="/dashboard/catalogos"
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition"
            >
              Catálogo planes
            </Link>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Enter para enviar · Shift+Enter para nueva línea</span>
            {draft.length > MAX_MESSAGE_LEN - 200 && (
              <span className="tabular-nums">
                {draft.length} / {MAX_MESSAGE_LEN}
              </span>
            )}
          </div>
        </div>
      </form>

      {/* Aria CoPilot side-panel — fixed top-right, debajo del topbar.
          Collapsable; NO afecta layout del chat. z-30 < drawer catálogo z-40. */}
      <AriaCoPilot
        suggestions={aria.suggestions}
        loading={aria.loading}
        open={ariaOpen}
        onToggle={() => setAriaOpen((v) => !v)}
        onClose={() => setAriaOpen(false)}
        onApply={aria.apply}
        onDismiss={aria.dismiss}
      />
    </div>
  );
}

/* ---------- Sub-componentes ---------- */

function ChatEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="text-center py-10"
    >
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 mb-5 shadow-lg shadow-indigo-300/40">
        <Sparkles className="w-7 h-7 text-white" strokeWidth={1.8} />
      </div>
      <h2 className="text-xl font-bold text-slate-900">
        Cuéntale al asistente qué necesitas cotizar
      </h2>
      <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
        RFC del cliente, número de líneas, plan y equipo si aplica. El
        asistente pregunta lo que falte y devuelve el PDF en 3-5 minutos.
      </p>
      <p className="mt-5 text-xs text-slate-500">
        Ejemplo:{" "}
        <span className="font-mono text-indigo-600">
          XAXX010101000, 25 líneas, plan EMPRESA 500, iPhone 15
        </span>
      </p>
    </motion.div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-center"
      >
        <div className="max-w-[80%] text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5">
          {message.text}
        </div>
      </motion.div>
    );
  }
  const isUser = message.role === "user";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && <AgentAvatar />}
      <div
        className={[
          "max-w-[85%] sm:max-w-md xl:max-w-xl rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap break-words",
          isUser
            ? "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white rounded-tr-sm shadow-md shadow-indigo-300/40"
            : "bg-white text-slate-900 border border-slate-200 rounded-tl-sm shadow-sm",
        ].join(" ")}
      >
        {message.text}
      </div>
      {isUser && <UserAvatar />}
    </motion.div>
  );
}

function AgentAvatar() {
  return (
    <div
      aria-hidden="true"
      className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-300/50"
    >
      <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      aria-hidden="true"
      className="shrink-0 w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700"
    >
      V
    </div>
  );
}

/**
 * ThinkingIndicator — typing dots de 21st "Animated AI Chat" con stagger.
 * Tres puntos indigo→cyan con animación de opacity + scale, delay 0.15s
 * entre cada uno. AnimatePresence-safe via motion wrappers.
 */
function ThinkingIndicator() {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3 justify-start"
    >
      <AgentAvatar />
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 inline-flex items-center gap-2 shadow-sm">
        <span
          className="inline-flex gap-1.5 items-center"
          aria-label="El agente está pensando"
        >
          <TypingDot index={0} />
          <TypingDot index={1} />
          <TypingDot index={2} />
        </span>
      </div>
    </motion.div>
  );
}

/**
 * TypingDot — framer-motion stagger animation. Cada dot pulsa opacity 0.3→1
 * y scale 0.85→1, con delay = index * 0.15s. Replica el patrón 21st AI Chat.
 */
function TypingDot({ index }: { index: number }) {
  return (
    <motion.span
      className="block w-1.5 h-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500"
      initial={{ opacity: 0.3, scale: 0.85 }}
      animate={{
        opacity: [0.3, 1, 0.3],
        scale: [0.85, 1, 0.85],
      }}
      transition={{
        duration: 1.05,
        repeat: Infinity,
        ease: "easeInOut",
        delay: index * 0.15,
      }}
    />
  );
}

/**
 * Copy por fase del polling.
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
  const [fallbackStart] = useState<number>(() => Date.now());
  const startedAt = job.kind === "polling" ? job.startedAt : fallbackStart;
  const stage: PollingStage = job.kind === "polling" ? job.stage : "normal";
  const elapsed = useElapsedSeconds(
    startedAt,
    job.kind === "polling" || job.kind === "starting",
  );
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const copy = STAGE_COPY[stage];
  const isWarn = copy.tone === "warn";
  const POLL_CAP_S = 300;
  const pct = Math.min(100, Math.round((elapsed / POLL_CAP_S) * 100));

  const rfcLabel = job.kind === "polling" && job.rfc ? job.rfc : null;

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border p-5 shadow-sm",
        isWarn
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-slate-200",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border",
            isWarn
              ? "bg-amber-100 border-amber-200"
              : "bg-gradient-to-br from-indigo-50 to-cyan-50 border-indigo-200",
          ].join(" ")}
        >
          <Spinner tone={isWarn ? "warn" : "info"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={[
                "text-sm font-bold",
                isWarn ? "text-amber-900" : "text-slate-900",
              ].join(" ")}
            >
              {copy.title}
            </p>
            <span
              className={[
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase",
                isWarn
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200",
              ].join(" ")}
            >
              Cotizando contra Telcel
            </span>
          </div>
          <p
            className={[
              "text-xs mt-1 leading-relaxed",
              isWarn ? "text-amber-800" : "text-slate-600",
            ].join(" ")}
          >
            {copy.body}
          </p>

          <div className="mt-3 inline-flex items-center gap-2">
            <span className="inline-flex gap-1.5 items-center" aria-hidden="true">
              <TypingDot index={0} />
              <TypingDot index={1} />
              <TypingDot index={2} />
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Cotizando contra Telcel… (~2 min)
            </span>
          </div>

          {/* Barra de progreso fina contra el cap de 5 min. */}
          <div
            className={[
              "mt-4 h-1.5 w-full rounded-full overflow-hidden",
              isWarn ? "bg-amber-100" : "bg-slate-100",
            ].join(" ")}
            aria-hidden="true"
          >
            <div
              className={[
                "h-full transition-all duration-500 ease-out",
                isWarn
                  ? "bg-gradient-to-r from-amber-400 to-amber-500"
                  : "bg-gradient-to-r from-indigo-500 to-cyan-500",
              ].join(" ")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            className={[
              "text-[11px] mt-2 tabular-nums font-mono",
              isWarn ? "text-amber-700" : "text-slate-500",
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
            className="shrink-0 text-xs text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-full hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
            aria-label="Cancelar la cotización en curso"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl bg-rose-50 border border-rose-200 p-5 shadow-sm"
    >
      <p className="text-sm font-bold text-rose-900">Telcel no respondió</p>
      <p className="text-xs text-rose-800 mt-1 leading-relaxed">
        {message} Tu cotización podría seguir corriendo del lado del operador
        — revisa Historial en unos minutos.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <motion.button
          type="button"
          onClick={onRetry}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-full bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-300/40 hover:shadow-rose-400/60 transition"
        >
          Reintentar
        </motion.button>
        <Link
          href="/dashboard/historial"
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 transition"
        >
          Ver historial
        </Link>
        <a
          href={mailto}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 transition"
        >
          Reportar problema
        </a>
      </div>
    </motion.div>
  );
}

function CompletedCard({
  pdfUrl,
  screenshotUrl,
  folio,
  monto,
  onReset,
}: {
  pdfUrl?: string;
  screenshotUrl?: string;
  folio: string;
  /**
   * Monto total de la cotización en MXN. Si el JobState no lo expone aún,
   * cae al fallback de tipografía sin NumberFlow. Hooking aquí mantiene la
   * lógica del hook intacta — si `monto` es undefined el card sigue siendo
   * useful con solo el folio.
   */
  monto?: number;
  onReset: () => void;
}) {
  const isProxyPath = pdfUrl ? /^\/api\/cotizaciones\//.test(pdfUrl) : false;
  const pdfInternoUrl = isProxyPath
    ? `/api/cotizaciones/${encodeURIComponent(folio)}/pdf?formato=interno`
    : null;

  const isDraftMode = !pdfUrl && Boolean(screenshotUrl);
  const safeScreenshotUrl =
    screenshotUrl &&
    /^\/api\/cotizaciones\/[A-Za-z0-9_-]{1,64}\/screenshot$/.test(screenshotUrl)
      ? screenshotUrl
      : undefined;

  const folioDisplay = folio.length > 12
    ? `#${folio.slice(0, 8).toUpperCase()}`
    : `#${folio.toUpperCase()}`;

  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl shadow-indigo-200/40 p-7"
      role="status"
    >
      {/* Glow accent esquina top-right (indigo→cyan blur). */}
      <div
        aria-hidden="true"
        className="absolute right-0 top-0 w-56 h-56 bg-gradient-to-br from-indigo-300/30 to-cyan-300/30 blur-3xl rounded-full pointer-events-none"
      />

      <div className="relative">
        {/* Chip mint "COTIZACIÓN COMPLETADA" con dot pulse emerald */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-widest">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            />
            Cotización completada
          </span>
        </div>

        {/* Folio big mono cyan */}
        <p className="font-mono text-3xl md:text-4xl font-black text-cyan-600 tracking-tight tabular-nums">
          {folioDisplay}
        </p>
        <p className="mt-1 text-xs text-slate-500 font-mono break-all">
          Folio interno: {folio}
        </p>

        {/* Monto big con NumberFlow si está disponible */}
        {typeof monto === "number" && Number.isFinite(monto) && (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-widest font-bold text-slate-500">
              Monto total
            </p>
            <p className="mt-1 text-4xl md:text-5xl font-extrabold tabular-nums text-slate-900 flex items-baseline gap-2">
              <span className="text-slate-500 text-2xl md:text-3xl">$</span>
              <NumberFlow
                value={monto}
                format={{
                  style: "decimal",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }}
              />
              <span className="text-slate-500 text-sm font-bold">MXN</span>
            </p>
          </div>
        )}

        {isDraftMode ? (
          <>
            <p className="mt-5 text-sm text-slate-700 leading-relaxed max-w-2xl">
              Este es un <strong className="text-slate-900">borrador sin RFC</strong>.
              El portal de Telcel no emite PDF oficial hasta capturar el
              cliente; te dejo la captura del resumen como evidencia.
            </p>

            {safeScreenshotUrl && (
              <div className="mt-6">
                <a
                  href={safeScreenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-200/40 transition"
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
            <p className="mt-5 text-sm text-slate-700 leading-relaxed max-w-2xl">
              El PDF oficial fue generado por el portal de Telcel. Descarga el
              formato cliente para enviar, o el formato interno con el desglose
              de rentabilidad para tu equipo.
            </p>

            {/* Botones grandes pill: PDF Cliente (gradient) + PDF Interno (outline) */}
            <div className="mt-6 flex flex-wrap gap-3">
              {pdfUrl && (
                <motion.a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 350, damping: 20 }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 text-white text-sm font-bold shadow-lg shadow-indigo-300/40 hover:shadow-indigo-400/60 transition"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  Descargar PDF Cliente
                </motion.a>
              )}
              {pdfInternoUrl && (
                <motion.a
                  href={pdfInternoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border-2 border-indigo-200 text-indigo-700 text-sm font-bold hover:border-indigo-400 hover:bg-indigo-50 transition"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  PDF Interno
                </motion.a>
              )}
              {safeScreenshotUrl && (
                <a
                  href={safeScreenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50 transition"
                >
                  <PhotoIcon className="w-4 h-4" />
                  Ver captura
                </a>
              )}
            </div>
          </>
        )}

        {/* Chips secundarias rounded-full */}
        <div className="mt-6 pt-5 border-t border-slate-200 flex flex-wrap gap-2">
          <Link
            href="/dashboard/optimizar"
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            Optimizar palancas →
          </Link>
          <Link
            href="/dashboard/historial"
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            Ver historial →
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            Cotizar otra similar →
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={[
        "rounded-2xl border p-5 shadow-sm",
        isError ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200",
      ].join(" ")}
    >
      <p
        className={[
          "text-sm font-bold",
          isError ? "text-rose-900" : "text-slate-900",
        ].join(" ")}
      >
        {title}
      </p>
      <p
        className={[
          "text-xs mt-1 leading-relaxed",
          isError ? "text-rose-800" : "text-slate-600",
        ].join(" ")}
      >
        {body}
      </p>
      <motion.button
        type="button"
        onClick={onAction}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={[
          "mt-4 inline-flex items-center px-4 py-2 text-sm font-bold rounded-full transition",
          isError
            ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-300/40 hover:shadow-rose-400/60"
            : "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-300/40 hover:shadow-indigo-400/60",
        ].join(" ")}
      >
        {actionLabel}
      </motion.button>
    </motion.div>
  );
}

function Spinner({ tone = "info" }: { tone?: "info" | "warn" }) {
  return (
    <svg
      className={[
        "animate-spin h-6 w-6",
        tone === "warn" ? "text-amber-500" : "text-indigo-600",
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

/** Reloj reactivo en segundos. */
function useElapsedSeconds(startedAt: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [active]);
  return Math.max(0, Math.floor((now - startedAt) / 1_000));
}
