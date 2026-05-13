"use client";

/**
 * useAriaVoice — capa de orquestación que el AriaCopilot consume con un
 * solo import. Junta:
 *   - useVoiceSettings (sessionStorage)
 *   - useVoiceInput    (SpeechRecognition es-MX)
 *   - useVoiceOutput   (SpeechSynthesis con cola + provider opcional)
 *
 * Expone una API plana para que el componente AriaCopilot.tsx no tenga que
 * pegar 4 hooks. También maneja:
 *   - Auto-send tras voz: cuando llega `transcript` final, espera 500ms
 *     (para que el usuario alcance a corregir) y llama `onAutoSend(text)`.
 *     Si `autoSend=false`, solo expone el transcript y deja que el padre
 *     decida cuándo enviar.
 *   - Auto-speak tras respuesta: el padre llama `speakAssistantMessage(text)`
 *     y este hook decide si lo lee o no según `settings.autoSpeak`.
 *
 * GUARD: si SpeechRecognition / speechSynthesis no existen, los flags
 * `inputSupported` / `outputSupported` son false. El padre debe esconder
 * los botones respectivos.
 *
 * Integración pendiente con el AriaCopilot principal:
 *
 *   // dentro de AriaCopilot.tsx
 *   const aria = useAriaVoice({
 *     onAutoSend: (text) => handleSendMessage(text),
 *   });
 *
 *   <MicButton
 *     isListening={aria.isListening}
 *     onToggle={aria.toggleListening}
 *     hasError={Boolean(aria.inputError)}
 *   />
 *   {aria.interimTranscript && <div>{aria.interimTranscript}</div>}
 *
 *   <SpeakerToggle
 *     enabled={aria.settings.autoSpeak}
 *     isSpeaking={aria.isSpeaking}
 *     onToggle={() => aria.patch({ autoSpeak: !aria.settings.autoSpeak })}
 *     onStop={aria.stopSpeaking}
 *   />
 *
 *   // Cuando llega respuesta nueva:
 *   useEffect(() => { aria.speakAssistantMessage(lastMessage); }, [lastMessage]);
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useVoiceSettings } from "./useVoiceSettings";
import { useVoiceInput } from "./useVoiceInput";
import { useVoiceOutput } from "./useVoiceOutput";
import { createElevenLabsProvider } from "@/lib/tts/elevenlabs";
import type { VoiceSettings } from "@/components/copilot/voice/VoiceSettingsPanel";

const AUTO_SEND_DELAY_MS = 500;

export interface UseAriaVoiceOptions {
  /**
   * Si está definido, este hook llama `onAutoSend(transcript)` 500ms después
   * de que termina la captura de voz. Útil para auto-enviar al chat. Si es
   * undefined, el caller debe leer `transcript` manualmente.
   */
  onAutoSend?: (text: string) => void;
  /**
   * Si false, NO se llama a onAutoSend (modo "voice fill only" — la voz
   * llena el textarea pero el usuario debe presionar Enviar manualmente).
   * Default true.
   */
  autoSend?: boolean;
  /**
   * `true` si el endpoint server-side `/api/tts/elevenlabs` está vivo.
   * El caller puede hacer un ping a `/api/tts/health` al montar y pasarlo.
   * Default false → el switch premium en settings queda gris.
   */
  premiumAvailable?: boolean;
}

export interface UseAriaVoiceResult {
  // Settings + persistencia
  settings: VoiceSettings;
  setSettings: (next: VoiceSettings) => void;
  patch: (partial: Partial<VoiceSettings>) => void;
  premiumAvailable: boolean;

  // Voice input
  inputSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  inputError: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;

  // Voice output
  outputSupported: boolean;
  isSpeaking: boolean;
  /** Habla un texto AHORA sin importar `autoSpeak` (re-leer mensaje). */
  speakNow: (text: string) => void;
  /** Habla solo si `settings.autoSpeak` está activo. Idempotente al texto. */
  speakAssistantMessage: (text: string) => void;
  stopSpeaking: () => void;
}

export function useAriaVoice(
  options: UseAriaVoiceOptions = {},
): UseAriaVoiceResult {
  const { onAutoSend, autoSend = true, premiumAvailable = false } = options;

  const { settings, setSettings, patch } = useVoiceSettings();

  // Provider TTS premium — solo se instancia si el usuario lo activó Y
  // el endpoint está disponible. useMemo para no recrearlo cada render.
  const provider = useMemo(() => {
    if (!settings.premiumTTS || !premiumAvailable) return null;
    return createElevenLabsProvider({ available: true });
  }, [settings.premiumTTS, premiumAvailable]);

  const input = useVoiceInput({
    lang: settings.lang,
  });

  const output = useVoiceOutput({
    lang: settings.lang,
    provider,
  });

  // Auto-send: cuando el usuario para de hablar y tenemos transcript final,
  // disparamos el callback después de un delay de gracia.
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Memorizamos qué transcripts ya enviamos para no duplicar si el usuario
  // re-abre el mic con texto residual.
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    // Disparamos auto-send cuando:
    //   1. Ya NO está listening (terminó la captura).
    //   2. Hay transcript no vacío y distinto al último enviado.
    //   3. autoSend está habilitado y hay callback.
    if (!autoSend || !onAutoSend) return;
    if (input.isListening) return;
    const text = input.transcript.trim();
    if (!text || text === lastSentRef.current) return;

    // Limpia timer previo (por si el usuario re-habló rápido).
    if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    autoSendTimerRef.current = setTimeout(() => {
      lastSentRef.current = text;
      onAutoSend(text);
      input.reset();
    }, AUTO_SEND_DELAY_MS);

    return () => {
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }
    };
  }, [
    autoSend,
    onAutoSend,
    input.isListening,
    input.transcript,
    input,
  ]);

  // Cleanup timer al desmontar.
  useEffect(() => {
    return () => {
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    };
  }, []);

  const speakAssistantMessage = useCallback(
    (text: string) => {
      if (!settings.autoSpeak || !text) return;
      output.speak(text);
    },
    [settings.autoSpeak, output],
  );

  // Si el usuario apaga el mic en settings mientras está escuchando, parar.
  useEffect(() => {
    if (!settings.inputEnabled && input.isListening) {
      input.stop();
    }
  }, [settings.inputEnabled, input]);

  // Si el usuario apaga auto-speak mientras ARIA está hablando, callamos.
  useEffect(() => {
    if (!settings.autoSpeak && output.isSpeaking) {
      output.stop();
    }
  }, [settings.autoSpeak, output]);

  return {
    settings,
    setSettings,
    patch,
    premiumAvailable,

    inputSupported: input.supported && settings.inputEnabled,
    isListening: input.isListening,
    transcript: input.transcript,
    interimTranscript: input.interimTranscript,
    inputError: input.error,
    startListening: input.start,
    stopListening: input.stop,
    toggleListening: input.toggle,
    resetTranscript: input.reset,

    outputSupported: output.supported,
    isSpeaking: output.isSpeaking,
    speakNow: output.speak,
    speakAssistantMessage,
    stopSpeaking: output.stop,
  };
}
