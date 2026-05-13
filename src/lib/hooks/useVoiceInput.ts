"use client";

/**
 * useVoiceInput — hook que envuelve la Web Speech API (SpeechRecognition)
 * para captura de voz en el composer de ARIA Copilot.
 *
 * Decisiones clave:
 *   - Lang: es-MX por default (cliente Hector está en México). Permitimos
 *     override por si en el futuro queremos abrir a otros locales.
 *   - continuous: false. Capturamos una sola frase y paramos — el flujo
 *     del copiloto es "habla → llena textarea → auto-send con delay".
 *     Para "push to talk" largo el caller puede llamar start()/stop() manual.
 *   - interimResults: true. Mostramos transcripción parcial mientras habla
 *     para feedback inmediato (igual que Siri/Gemini).
 *   - Feature detection: `SpeechRecognition || webkitSpeechRecognition`.
 *     Firefox no implementa la API (al cierre 2026) — devolvemos
 *     `supported: false` y el caller esconde el botón.
 *   - HTTPS requerido. Vercel prod ya da HTTPS; localhost dev también
 *     funciona (browsers tratan localhost como "secure context").
 *
 * Manejo de errores típicos (event.error string):
 *   - "not-allowed"     → usuario rechazó el permiso del micrófono.
 *   - "no-speech"       → silencio prolongado; reiniciamos limpio sin alarmar.
 *   - "audio-capture"   → sin micrófono físico.
 *   - "network"         → API necesita red (Chrome usa servicio Google).
 *   - "aborted"         → stop() manual; NO es error real, lo silenciamos.
 *
 * Cleanup: nos aseguramos de llamar `recognition.abort()` al desmontar para
 * que el ícono del mic del browser se apague aunque el componente padre
 * se haya destruido (e.g. user cerró el panel ARIA mid-speech).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseVoiceInputOptions {
  /** BCP-47 locale. Default `es-MX`. */
  lang?: string;
  /**
   * Callback opcional que recibe la transcripción FINAL cuando la API marca
   * `isFinal=true`. Útil para auto-enviar sin tener que observar `transcript`
   * desde el componente padre.
   */
  onFinal?: (text: string) => void;
}

export interface UseVoiceInputResult {
  /**
   * `true` si el browser implementa SpeechRecognition. Si es `false`, el
   * caller debe esconder el botón del micrófono (no mostrar "no funciona").
   */
  supported: boolean;
  /** `true` mientras la API está activa escuchando audio. */
  isListening: boolean;
  /** Transcripción consolidada FINAL de esta sesión de start(). */
  transcript: string;
  /** Transcripción parcial mientras el motor todavía decide. */
  interimTranscript: string;
  /** Último error legible (`"not-allowed"`, `"no-speech"`, etc.) o null. */
  error: string | null;
  /** Comienza a escuchar. No-op si ya estaba listening o no hay soporte. */
  start: () => void;
  /** Detiene la escucha (espera el último final result). */
  stop: () => void;
  /** Si está escuchando para; si no, empieza. */
  toggle: () => void;
  /** Limpia transcript/interim/error sin tocar `isListening`. */
  reset: () => void;
}

// Constructor signatures cambian entre browsers. Esto es lo que devuelve
// `window.SpeechRecognition || window.webkitSpeechRecognition`. Usamos
// `any` solo en el casting interno; la API pública es 100% tipada.
type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(
  options: UseVoiceInputOptions = {},
): UseVoiceInputResult {
  const { lang = "es-MX", onFinal } = options;

  // `supported` se calcula lazy una sola vez. Es una propiedad del entorno
  // (browser) que no cambia mid-session, así que no necesita useState.
  // Lazy initializer evita ejecutar la detección en SSR.
  const [supported] = useState<boolean>(() => getSpeechRecognitionCtor() !== null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Mantenemos onFinal en ref para no reinstanciar handlers cada render.
  const onFinalRef = useRef<typeof onFinal>(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Inicializa la instancia de SpeechRecognition una sola vez al montar
  // (si hay soporte). Volvemos a configurar `.lang` cuando cambia el prop.
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = lang;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += text;
        else interimChunk += text;
      }
      if (finalChunk) {
        setTranscript((prev) => (prev ? `${prev} ${finalChunk}`.trim() : finalChunk.trim()));
        setInterimTranscript("");
        onFinalRef.current?.(finalChunk.trim());
      } else {
        setInterimTranscript(interimChunk);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" es siempre user-driven (stop()) y "no-speech" es timeout
      // benigno — los silenciamos para no spamear UI roja.
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(event.error);
      }
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    rec.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognitionRef.current = rec;

    return () => {
      try {
        rec.abort();
      } catch {
        // Si el browser ya lo cerró, ignorar.
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || isListening) return;
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    try {
      rec.start();
    } catch (e) {
      // Chrome lanza InvalidStateError si llamamos start() sobre una
      // sesión que aún no soltó el micrófono. Hacemos abort + retry.
      console.warn("[useVoiceInput] start() failed, retrying", e);
      try {
        rec.abort();
        rec.start();
      } catch (e2) {
        setError("start-failed");
        console.error("[useVoiceInput] retry failed", e2);
      }
    }
  }, [isListening]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // ignore: si ya estaba parado, no pasa nada.
    }
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    supported,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    toggle,
    reset,
  };
}
