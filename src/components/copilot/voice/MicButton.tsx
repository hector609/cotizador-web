"use client";

/**
 * MicButton — botón pill para activar/desactivar voice input en el composer
 * de ARIA Copilot.
 *
 * Estados visuales:
 *   - Idle      → ícono Mic outline, border indigo-200, hover bg-indigo-50.
 *   - Listening → ícono MicOff, ring indigo-300, bg cyan-100, escala 1.05,
 *                 animación pulse + waveform overlay opcional.
 *   - Error     → tinted rojo suave (border-red-300, bg-red-50).
 *
 * A11Y:
 *   - aria-pressed para reflejar toggle state.
 *   - aria-label dinámico ("Activar micrófono" / "Detener micrófono").
 *   - focus-visible ring para teclado.
 *
 * Si el browser no soporta SpeechRecognition (`supported=false`), el
 * componente padre NO debe renderizarlo. Aquí asumimos que sí hay soporte.
 *
 * ASCII visual:
 *
 *   Idle:                  Listening:
 *   ┌──────────┐           ┌──────────┐
 *   │  ( mic ) │           │ )) mic (( │ ← ring pulsando
 *   └──────────┘           └──────────┘
 *      indigo                cyan + glow
 */

import { Mic, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MicButtonProps {
  /** `true` cuando la API está activamente escuchando. */
  isListening: boolean;
  /** Click handler — debe llamar `toggle()` del hook. */
  onToggle: () => void;
  /** Si hubo error reciente, tinta el botón en rojo. */
  hasError?: boolean;
  /** Deshabilitado (ej. mientras ARIA está streaming respuesta). */
  disabled?: boolean;
  /** Tamaño del botón en px. Default 40 (h-10 w-10). */
  size?: number;
  /** className extra del componente padre. */
  className?: string;
}

export function MicButton({
  isListening,
  onToggle,
  hasError = false,
  disabled = false,
  size = 40,
  className = "",
}: MicButtonProps) {
  const label = isListening
    ? "Detener micrófono"
    : hasError
    ? "Reintentar micrófono"
    : "Activar micrófono";

  const base =
    "relative inline-flex items-center justify-center rounded-full border transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const tone = hasError
    ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
    : isListening
    ? "border-indigo-300 bg-cyan-100 text-indigo-700 shadow-[0_0_0_4px_rgba(99,102,241,0.15)]"
    : "border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50";

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={isListening}
      aria-label={label}
      title={label}
      className={`${base} ${tone} ${className}`}
      style={{ width: size, height: size }}
      animate={isListening ? { scale: 1.05 } : { scale: 1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      {/* Halo pulsante en estado listening — escala animada para indicar audio. */}
      <AnimatePresence>
        {isListening && (
          <motion.span
            key="halo"
            className="absolute inset-0 rounded-full bg-indigo-400/30"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.6, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
      <span className="relative inline-flex">
        {isListening ? (
          <MicOff size={size * 0.45} strokeWidth={2.2} />
        ) : (
          <Mic size={size * 0.45} strokeWidth={2.2} />
        )}
      </span>
    </motion.button>
  );
}
