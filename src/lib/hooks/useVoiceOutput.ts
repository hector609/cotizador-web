"use client";

/**
 * useVoiceOutput — hook que envuelve `speechSynthesis` (TTS nativo del
 * browser) para que ARIA Copilot hable sus respuestas.
 *
 * Decisiones clave:
 *   - Default = browser nativo (gratis, sin API key, latencia ~0).
 *     Premium ElevenLabs/Cartesia se enchufa via `provider` prop opcional
 *     — ver `src/lib/tts/elevenlabs.ts`.
 *   - Voz: priorizamos es-MX → es-US → es-ES → cualquier `es*` → default.
 *     `speechSynthesis.getVoices()` puede devolver [] en el primer call
 *     (Chrome carga las voces async), así que escuchamos `voiceschanged`.
 *   - Rate: 1.05 (10% más rápido que default). Suena más natural / con
 *     menos pausas robóticas. Pitch 1.0 default.
 *   - Cola por oraciones: si la respuesta es larga (>~200 chars) la
 *     cortamos por `.!?` y encolamos utterances. Mejora UX porque el
 *     usuario percibe que ARIA "respira" entre frases en vez de un
 *     monólogo continuo. La API hace esto bien con utterances cortos.
 *   - Pre-process: stripeamos markdown (`*`, `_`, backticks, `#`,
 *     links `[txt](url)` → `txt`), emojis y URLs crudas. Mantenemos
 *     números, $ y porcentajes — el motor TTS los pronuncia OK en es-MX.
 *
 * Hook listo para enchufe premium: el caller puede pasar un `provider`
 * con shape `TTSProvider` (ver `src/lib/tts/types.ts`) y este hook lo
 * usará en vez del browser. Si el provider falla, hacemos fallback al
 * browser nativo (graceful degradation).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { TTSProvider } from "@/lib/tts/types";

export interface UseVoiceOutputOptions {
  /** BCP-47 locale para selección de voz. Default `es-MX`. */
  lang?: string;
  /** Velocidad de habla (0.1 - 10). Default 1.05. */
  rate?: number;
  /** Tono (0 - 2). Default 1.0. */
  pitch?: number;
  /** Volumen (0 - 1). Default 1.0. */
  volume?: number;
  /**
   * Provider premium opcional (ElevenLabs/Cartesia). Si está definido y su
   * `available` es true, se usa en lugar del browser. Si la llamada falla,
   * caemos al browser automáticamente.
   */
  provider?: TTSProvider | null;
}

export interface UseVoiceOutputResult {
  /** `true` si `speechSynthesis` existe en el browser. */
  supported: boolean;
  /** `true` mientras hay una utterance activa o cola pendiente. */
  isSpeaking: boolean;
  /** Encola y reproduce el texto. Strip de markdown automático. */
  speak: (text: string) => void;
  /** Detiene la utterance actual y limpia la cola. */
  stop: () => void;
  /** Pausa (puede resumirse con resume()). */
  pause: () => void;
  /** Reanuda una utterance pausada. */
  resume: () => void;
}

/**
 * Limpia el texto antes de mandárselo al TTS:
 *   - Markdown enfatizado (`*texto*`, `_texto_`, `**texto**`) → "texto"
 *   - Backticks (`código`) → "código"
 *   - Headers (`# título`) → "título"
 *   - Links `[texto](url)` → "texto"
 *   - URLs crudas (http://…) → eliminadas (TTS las deletrea horrible)
 *   - Emojis (rango unicode pictográfico) → eliminados
 *   - Múltiples espacios → uno solo
 */
export function stripForTTS(raw: string): string {
  let s = raw;
  // Links markdown.
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Headers (# ## ###).
  s = s.replace(/^#{1,6}\s+/gm, "");
  // Bold/italic/code inline.
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  // URLs crudas.
  s = s.replace(/https?:\/\/\S+/g, "");
  // Emojis (rangos pictográficos comunes — no exhaustivo pero cubre 99%).
  s = s.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu,
    "",
  );
  // Bullets sueltos al inicio de línea.
  s = s.replace(/^[-•·]\s+/gm, "");
  // Espacios múltiples.
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Parte el texto en oraciones para que la cola del TTS pueda intercalar
 * micro-pausas naturales. Si una oración es muy corta (<25 chars) la
 * juntamos con la siguiente para no sonar entrecortado.
 */
export function splitIntoSentences(text: string): string[] {
  if (text.length < 200) return [text];
  const raw = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buffer = "";
  for (const chunk of raw) {
    if (!chunk.trim()) continue;
    if (buffer.length + chunk.length < 25) {
      buffer = buffer ? `${buffer} ${chunk}` : chunk;
    } else {
      if (buffer) {
        out.push(`${buffer} ${chunk}`.trim());
        buffer = "";
      } else {
        out.push(chunk.trim());
      }
    }
  }
  if (buffer) out.push(buffer.trim());
  return out;
}

/**
 * Elige la mejor voz disponible para el locale pedido.
 *   1. Match exacto (`es-MX`).
 *   2. Mismo idioma (`es-US`, `es-ES`, `es-419`…).
 *   3. Cualquier voz que arranca con `es`.
 *   4. Default del browser (`null` → SpeechSynthesisUtterance.voice = null
 *      hace que el motor elija solo, suele ser el locale del SO).
 */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const lower = lang.toLowerCase();
  const exact = voices.find((v) => v.lang.toLowerCase() === lower);
  if (exact) return exact;
  const baseLang = lower.split("-")[0];
  const sameLang = voices.find((v) =>
    v.lang.toLowerCase().startsWith(`${baseLang}-`),
  );
  if (sameLang) return sameLang;
  const anySpanish = voices.find((v) =>
    v.lang.toLowerCase().startsWith(baseLang),
  );
  return anySpanish ?? null;
}

export function useVoiceOutput(
  options: UseVoiceOutputOptions = {},
): UseVoiceOutputResult {
  const {
    lang = "es-MX",
    rate = 1.05,
    pitch = 1.0,
    volume = 1.0,
    provider = null,
  } = options;

  // `supported` es propiedad del entorno (no cambia mid-session). Lazy init
  // evita correr detection en SSR (typeof window check).
  const [supported] = useState<boolean>(
    () => typeof window !== "undefined" && !!window.speechSynthesis,
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Cola FIFO de oraciones pendientes (para el path browser).
  const queueRef = useRef<string[]>([]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // Lock para que la cola no se procese en paralelo.
  const processingRef = useRef(false);
  // AbortController para cancelar requests del provider premium.
  const providerAbortRef = useRef<AbortController | null>(null);
  // Element <audio> reutilizable cuando el provider devuelve blob.
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Carga de voces (cuando hay soporte). `voiceschanged` dispara cuando
  // Chrome termina de hidratar la lista async.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const refreshVoice = () => {
      const list = synth.getVoices();
      voiceRef.current = pickVoice(list, lang);
    };
    refreshVoice();
    // Chrome dispara `voiceschanged` cuando las voces async terminan de cargar.
    synth.addEventListener("voiceschanged", refreshVoice);
    return () => {
      synth.removeEventListener("voiceschanged", refreshVoice);
      // Cancelar cualquier utterance pendiente al desmontar.
      synth.cancel();
    };
  }, [lang]);

  // Procesa la cola browser (un utterance a la vez). Usamos un ref para
  // permitir auto-recursión sin caer en "used before declared" del linter
  // de hooks: `processBrowserQueueRef.current` se setea al final.
  const processBrowserQueueRef = useRef<() => void>(() => {});
  const processBrowserQueue = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (processingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      setIsSpeaking(false);
      return;
    }
    processingRef.current = true;
    const u = new SpeechSynthesisUtterance(next);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    if (voiceRef.current) u.voice = voiceRef.current;
    u.onend = () => {
      processingRef.current = false;
      // Siguiente oración (si la hay). Vamos vía ref para mantener autoref
      // sin que el linter se queje del orden de declaración.
      if (queueRef.current.length > 0) processBrowserQueueRef.current();
      else setIsSpeaking(false);
    };
    u.onerror = (event) => {
      // "interrupted"/"canceled" pasan cuando llamamos stop() — no log.
      const err = event.error;
      if (err && err !== "interrupted" && err !== "canceled") {
        console.warn("[useVoiceOutput] utterance error", err);
      }
      processingRef.current = false;
      queueRef.current = [];
      setIsSpeaking(false);
    };
    window.speechSynthesis.speak(u);
  }, [lang, rate, pitch, volume]);
  // Mantener el ref sync con la última closure.
  useEffect(() => {
    processBrowserQueueRef.current = processBrowserQueue;
  }, [processBrowserQueue]);

  const stop = useCallback(() => {
    queueRef.current = [];
    processingRef.current = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (providerAbortRef.current) {
      providerAbortRef.current.abort();
      providerAbortRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = "";
      audioElRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speakBrowser = useCallback(
    (text: string) => {
      const clean = stripForTTS(text);
      if (!clean) return;
      const chunks = splitIntoSentences(clean);
      queueRef.current.push(...chunks);
      setIsSpeaking(true);
      processBrowserQueue();
    },
    [processBrowserQueue],
  );

  const speakWithProvider = useCallback(
    async (text: string, p: TTSProvider) => {
      const clean = stripForTTS(text);
      if (!clean) return;
      setIsSpeaking(true);
      const abort = new AbortController();
      providerAbortRef.current = abort;
      try {
        const blob = await p.synthesize(clean, { lang, signal: abort.signal });
        if (abort.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioElRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioElRef.current = null;
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioElRef.current = null;
          // Fallback al browser nativo si el blob no se pudo reproducir.
          console.warn("[useVoiceOutput] provider audio failed, falling back");
          speakBrowser(text);
        };
        await audio.play();
      } catch (e) {
        if (abort.signal.aborted) return;
        console.warn(
          "[useVoiceOutput] provider failed, falling back to browser",
          e,
        );
        // Fallback robusto al browser nativo.
        speakBrowser(text);
      }
    },
    [lang, speakBrowser],
  );

  const speak = useCallback(
    (text: string) => {
      if (!text) return;
      // Si ya hay algo hablando, lo cortamos limpio antes (UX expectativa
      // estándar — usuario manda "lee esto" y espera que sea AHORA).
      stop();
      if (provider && provider.available) {
        void speakWithProvider(text, provider);
      } else if (supported) {
        speakBrowser(text);
      }
    },
    [provider, supported, stop, speakWithProvider, speakBrowser],
  );

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.resume();
  }, []);

  return {
    supported,
    isSpeaking,
    speak,
    stop,
    pause,
    resume,
  };
}
