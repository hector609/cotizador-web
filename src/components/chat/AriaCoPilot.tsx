"use client";

/**
 * AriaCoPilot — side panel proactivo para /dashboard/cotizar.
 *
 * Concepto:
 *   Aria mira el estado del chat en vivo (RFC tipeado, plan, tramite, último
 *   resultado A/B, idle time) y propone 0-2 sugerencias accionables sin
 *   interrumpir el flow. Posición: fixed top-right, debajo del topbar, ANTES
 *   del catalogo drawer (z-index < 40). Collapsado por default como pill;
 *   expandido es un panel de 320px con sticky scroll.
 *
 * Decisión side-panel vs inline (2026-05-13):
 *   - INLINE (cards dentro del scroll de mensajes) tendría problemas:
 *       * Se mezclan con turnos del chat → confunde "qué dijo el agente".
 *       * Aria es CONTEXTUAL/efímera; ensuciaría el historial.
 *       * Si dismiss → scrollback raro.
 *   - SIDE-PANEL fixed top-right (este componente):
 *       * Aria vive AL LADO sin tocar el flujo conversacional principal.
 *       * Collapsable: cuando hay 0 tips → pill mini, nunca estorba.
 *       * Cuando hay tips → panel sticky con animate fade-up, dismissables.
 *       * Mobile: el panel ocupa width full < drawer (z-30 vs drawer z-40).
 *
 * NO toca el hook useChatCotizar. El padre (ChatInterface) le pasa el
 * snapshot y los handlers de aplicar/dismiss.
 *
 * A11Y:
 *   - aria-live="polite" en la lista de tips (anuncia nuevos sin interrumpir).
 *   - aria-expanded en el toggle pill.
 *   - Focus management: al abrir, foco al primer tip; al cerrar, foco al pill.
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import type { AriaSuggestion } from "@/lib/hooks/useAriaCoPilot";

interface AriaCoPilotProps {
  suggestions: AriaSuggestion[];
  loading: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onApply: (s: AriaSuggestion) => void;
  onDismiss: (id: string) => void;
  /** Callback opcional para abrir el copilot global flotante (si existe). */
  onOpenGlobalCopilot?: () => void;
}

/**
 * Tips estáticos didácticos. Se muestran en una sección "Aprende mientras
 * cotizas" al pie del panel; son consejos generales del producto, no
 * dependientes del estado actual. Estables (no se piden al backend).
 */
const STATIC_TIPS: Array<{
  id: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}> = [
  {
    id: "tip-rfc",
    icon: Lightbulb,
    title: "RFC define el trámite",
    body: "13 chars = persona física (CAMBIO PLAN). 12 chars = persona moral (ACTIVACION).",
  },
  {
    id: "tip-multiperfil",
    icon: TrendingUp,
    title: "Multi-perfil mejora A/B",
    body: "Agregar líneas extra amortiza el costo del equipo y sube tu rentabilidad.",
  },
  {
    id: "tip-palancas",
    icon: HelpCircle,
    title: "Palancas hacen la oferta",
    body: "Aportación, meses gratis o descuento renta — combínalos en /optimizar.",
  },
];

function levelStyles(level: AriaSuggestion["level"]) {
  switch (level) {
    case "warn":
      return {
        card: "bg-amber-50 border-amber-200",
        iconWrap: "bg-amber-100 text-amber-700",
        title: "text-amber-900",
        body: "text-amber-800",
        btn: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-300/40",
        Icon: AlertTriangle,
      };
    case "action":
      return {
        card: "bg-gradient-to-br from-indigo-50 to-cyan-50 border-indigo-200",
        iconWrap: "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white",
        title: "text-slate-900",
        body: "text-slate-700",
        btn: "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-indigo-300/40",
        Icon: Sparkles,
      };
    default:
      return {
        card: "bg-white border-slate-200",
        iconWrap: "bg-cyan-50 text-cyan-700",
        title: "text-slate-900",
        body: "text-slate-600",
        btn: "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-indigo-300/40",
        Icon: Lightbulb,
      };
  }
}

export function AriaCoPilot({
  suggestions,
  loading,
  open,
  onToggle,
  onClose,
  onApply,
  onDismiss,
  onOpenGlobalCopilot,
}: AriaCoPilotProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(open);

  const count = suggestions.length;

  // Focus management: al abrir → foco al panel; al cerrar → foco al toggle.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // Defer al siguiente tick para que motion ya haya montado el div.
      const id = window.setTimeout(() => panelRef.current?.focus(), 50);
      wasOpenRef.current = true;
      return () => window.clearTimeout(id);
    }
    if (!open && wasOpenRef.current) {
      const id = window.setTimeout(() => toggleRef.current?.focus(), 0);
      wasOpenRef.current = false;
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Escape cierra el panel.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Toggle pill — siempre visible top-right del shell del chat. Sticky
          vertical bajo el topbar (top-20 ≈ 80px). z-30 < drawer z-40. */}
      <div className="pointer-events-none fixed top-20 right-4 lg:right-6 z-30 flex flex-col items-end gap-3">
        <motion.button
          ref={toggleRef}
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="aria-copilot-panel"
          aria-label={
            open
              ? "Cerrar panel de Aria"
              : count > 0
                ? `Abrir panel de Aria — ${count} sugerencia${count === 1 ? "" : "s"}`
                : "Abrir panel de Aria"
          }
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className={[
            "pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-400/40 hover:shadow-indigo-500/60 transition border border-white/30 backdrop-blur-sm",
            "bg-gradient-to-br from-indigo-600 to-cyan-500",
          ].join(" ")}
        >
          <span className="relative inline-flex items-center justify-center w-5 h-5">
            <Sparkles className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            {/* Pulse halo cuando hay tips no leídos. */}
            {count > 0 && !open && (
              <motion.span
                className="absolute inset-0 rounded-full bg-white/40"
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                aria-hidden="true"
              />
            )}
          </span>
          <span className="hidden sm:inline">Aria sugiere</span>
          <span className="sm:hidden">Aria</span>
          {count > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white text-indigo-700 text-[10px] font-extrabold tabular-nums"
              aria-hidden="true"
            >
              {count}
            </span>
          )}
        </motion.button>
      </div>

      {/* Panel expandido — fixed 320px wide, sticky bajo el topbar. z-30 para
          no tapar el drawer del catálogo (z-40). */}
      <AnimatePresence>
        {open && (
          <motion.aside
            id="aria-copilot-panel"
            key="aria-panel"
            ref={panelRef}
            tabIndex={-1}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
            className="fixed top-32 right-4 lg:right-6 bottom-32 z-30 w-[calc(100vw-2rem)] sm:w-80 max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl shadow-indigo-200/40 flex flex-col overflow-hidden focus:outline-none focus:ring-4 focus:ring-indigo-100"
            role="complementary"
            aria-label="Aria copiloto de cotización"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-gradient-to-br from-indigo-50/50 to-cyan-50/50">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  aria-hidden="true"
                  className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-300/40"
                >
                  <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    Aria · Copiloto
                  </p>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 flex items-center gap-1.5">
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      animate={
                        loading
                          ? { opacity: [0.3, 1, 0.3] }
                          : { opacity: [1, 0.5, 1] }
                      }
                      transition={{
                        duration: loading ? 0.8 : 1.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      aria-hidden="true"
                    />
                    {loading ? "Pensando…" : "Atenta"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                aria-label="Cerrar panel de Aria"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {/* Lista de tips activos */}
            <div
              className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
              aria-live="polite"
              aria-atomic="false"
            >
              {suggestions.length === 0 && !loading && (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 mb-2">
                    <Sparkles
                      className="w-5 h-5 text-slate-400"
                      strokeWidth={1.5}
                    />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-[220px] mx-auto">
                    Estoy lista. Empieza a escribir tu cotización y te iré
                    avisando si veo algo útil.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {suggestions.map((s) => {
                  const styles = levelStyles(s.level);
                  const Icon = styles.Icon;
                  return (
                    <motion.div
                      key={s.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className={[
                        "relative rounded-xl border p-3 shadow-sm",
                        styles.card,
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => onDismiss(s.id)}
                        className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white/60 transition"
                        aria-label={`Ignorar sugerencia: ${s.title}`}
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <div className="flex items-start gap-2.5 pr-6">
                        <div
                          className={[
                            "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                            styles.iconWrap,
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          <Icon className="w-4 h-4" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={[
                              "text-xs font-bold leading-tight",
                              styles.title,
                            ].join(" ")}
                          >
                            {s.title}
                          </p>
                          <p
                            className={[
                              "mt-1 text-[11px] leading-relaxed",
                              styles.body,
                            ].join(" ")}
                          >
                            {s.body}
                          </p>
                          {s.action && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <motion.button
                                type="button"
                                onClick={() => onApply(s)}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                className={[
                                  "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm transition",
                                  styles.btn,
                                ].join(" ")}
                              >
                                {s.action.label}
                                <ChevronRight
                                  className="w-3 h-3"
                                  strokeWidth={2}
                                />
                              </motion.button>
                              <button
                                type="button"
                                onClick={() => onDismiss(s.id)}
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-white/60 transition"
                              >
                                Ignorar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Sección "Aprende mientras cotizas" — tips estáticos. */}
              <div className="pt-3 mt-3 border-t border-slate-200">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2 px-1">
                  Aprende mientras cotizas
                </p>
                <div className="space-y-2">
                  {STATIC_TIPS.map((t) => {
                    const Icon = t.icon;
                    return (
                      <div
                        key={t.id}
                        className="flex items-start gap-2 px-1 py-1.5 rounded-lg hover:bg-slate-50 transition"
                      >
                        <Icon
                          className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-[11px] font-bold text-slate-900 leading-tight">
                            {t.title}
                          </p>
                          <p className="text-[10px] text-slate-600 leading-relaxed">
                            {t.body}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer — link al copilot global flotante. */}
            {onOpenGlobalCopilot && (
              <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={onOpenGlobalCopilot}
                  className="w-full inline-flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] font-bold text-indigo-700 hover:bg-white transition"
                >
                  <span>Abrir Aria completa</span>
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
