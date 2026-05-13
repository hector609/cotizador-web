"use client";

/**
 * VoiceWaveform — 5 barras animadas que pulsan mientras ARIA escucha.
 *
 * Inspiración: Siri / Gemini / WhatsApp recording indicator. Uso de
 * `framer-motion` con `animate` arrays + `repeat: Infinity` y `delay`
 * por barra para crear el efecto stagger de ola.
 *
 * Tokens LUMINA: gradient indigo-600 → cyan-500 para que pertenezca al
 * lenguaje visual de ARIA. Las barras crecen/contraen en `scaleY` para
 * no triggerear layout (composite-only).
 */

import { motion } from "framer-motion";

const BAR_COUNT = 5;
const HEIGHTS = [0.4, 0.7, 1.0, 0.7, 0.4]; // amplitud base por barra

interface VoiceWaveformProps {
  /** `true` para animar; `false` colapsa las barras al mínimo. */
  active: boolean;
  /** Tamaño en px (altura total). Default 24. */
  size?: number;
  /** Override CSS color (clase Tailwind). Default gradient indigo→cyan. */
  className?: string;
}

export function VoiceWaveform({
  active,
  size = 24,
  className,
}: VoiceWaveformProps) {
  return (
    <div
      className={
        className ??
        "flex items-center gap-[3px] [&_span]:bg-gradient-to-b [&_span]:from-indigo-500 [&_span]:to-cyan-500"
      }
      style={{ height: size }}
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const base = HEIGHTS[i] ?? 0.5;
        return (
          <motion.span
            key={i}
            className="block w-[3px] rounded-full"
            style={{ height: size }}
            animate={
              active
                ? {
                    scaleY: [base * 0.3, base, base * 0.3],
                  }
                : { scaleY: 0.2 }
            }
            transition={
              active
                ? {
                    duration: 0.9,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.12,
                  }
                : { duration: 0.2 }
            }
          />
        );
      })}
    </div>
  );
}
