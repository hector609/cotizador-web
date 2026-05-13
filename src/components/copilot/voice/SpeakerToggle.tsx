"use client";

/**
 * SpeakerToggle — pill rounded-full para el header de ARIA Copilot que
 * activa/desactiva la voz de salida global (auto-speak respuestas).
 *
 * Estados:
 *   - Off         → Volume2 outline gris, tooltip "Activar voz"
 *   - On idle     → Volume2 indigo, ring suave, tooltip "Desactivar voz"
 *   - On speaking → Volume2 pulsando + barra cyan animada debajo
 *                   + botón inline "Detener" cuando se hover
 *
 * Persistencia: el padre lee/escribe en `sessionStorage['aria-voice-enabled']`
 * y pasa el estado aquí. Este componente es presentational puro.
 */

import { Volume2, VolumeX, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SpeakerToggleProps {
  /** `true` si voz output global está habilitada. */
  enabled: boolean;
  /** `true` si actualmente está reproduciendo una utterance. */
  isSpeaking: boolean;
  /** Toggle voice on/off. */
  onToggle: () => void;
  /** Detener la utterance actual (no cambia `enabled`). */
  onStop: () => void;
  className?: string;
}

export function SpeakerToggle({
  enabled,
  isSpeaking,
  onToggle,
  onStop,
  className = "",
}: SpeakerToggleProps) {
  const label = enabled
    ? "Desactivar lectura de respuestas"
    : "Activar lectura de respuestas";

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <motion.button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        aria-label={label}
        title={label}
        whileTap={{ scale: 0.95 }}
        className={`relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 ${
          enabled
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
        }`}
      >
        {enabled ? (
          <Volume2 size={16} strokeWidth={2.2} />
        ) : (
          <VolumeX size={16} strokeWidth={2.2} />
        )}
        <span>{enabled ? "Voz" : "Voz"}</span>
        <AnimatePresence>
          {isSpeaking && (
            <motion.span
              key="speak-bar"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              className="absolute inset-x-2 bottom-0.5 h-[2px] origin-left rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
              transition={{ duration: 0.4 }}
            />
          )}
        </AnimatePresence>
      </motion.button>
      <AnimatePresence>
        {isSpeaking && (
          <motion.button
            key="stop"
            type="button"
            onClick={onStop}
            aria-label="Detener lectura"
            title="Detener lectura"
            initial={{ opacity: 0, scale: 0.8, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: "auto" }}
            exit={{ opacity: 0, scale: 0.8, width: 0 }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <Square size={12} fill="currentColor" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
