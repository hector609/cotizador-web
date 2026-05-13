"use client";

/**
 * SpeakMessageButton — botón flotante mini al lado de cada mensaje
 * assistant de ARIA. Click → vuelve a leer ese mensaje en voz alta.
 *
 * Usage:
 *
 *   <div className="group relative">
 *     <MessageBubble text={msg.text} />
 *     <SpeakMessageButton
 *       text={msg.text}
 *       isSpeaking={isThisOneSpeaking}
 *       onSpeak={() => voice.speak(msg.text)}
 *       onStop={voice.stop}
 *       className="absolute -right-9 top-2 opacity-0 group-hover:opacity-100"
 *     />
 *   </div>
 */

import { Volume2, Square } from "lucide-react";
import { motion } from "framer-motion";

interface SpeakMessageButtonProps {
  /** Texto a hablar (el padre puede usarlo para tracking del mensaje activo). */
  text: string;
  /** `true` si justamente esta utterance es la que está sonando ahora. */
  isSpeaking: boolean;
  /** Callback de speak (debe llamar voice.speak(text)). */
  onSpeak: () => void;
  /** Callback de stop. */
  onStop: () => void;
  className?: string;
}

export function SpeakMessageButton({
  text,
  isSpeaking,
  onSpeak,
  onStop,
  className = "",
}: SpeakMessageButtonProps) {
  const handleClick = () => {
    if (isSpeaking) onStop();
    else onSpeak();
  };
  const label = isSpeaking
    ? "Detener lectura del mensaje"
    : "Leer mensaje en voz alta";
  return (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      // text está incluido como prop para que el padre pueda re-render selectivo;
      // no lo usamos directamente porque ya lo pasa el caller a onSpeak.
      data-text-len={text.length}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:text-indigo-600 hover:border-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${className}`}
    >
      {isSpeaking ? (
        <Square size={10} fill="currentColor" />
      ) : (
        <Volume2 size={12} strokeWidth={2.4} />
      )}
    </motion.button>
  );
}
