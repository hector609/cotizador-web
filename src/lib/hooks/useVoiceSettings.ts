"use client";

/**
 * useVoiceSettings — persiste configuración de voz en sessionStorage para
 * que sobreviva navegaciones dentro del tab pero NO entre tabs distintas.
 *
 * Decisión: sessionStorage (no localStorage) porque la voz es UX activa —
 * un usuario que cierra y vuelve mañana probablemente prefiere arrancar
 * silencioso (no que ARIA empiece a hablar sin contexto).
 *
 * Defaults:
 *   - inputEnabled: true  (mic disponible si hay soporte)
 *   - autoSpeak:    false (NO asustar primera vez con voz inesperada)
 *   - premiumTTS:   false (browser nativo hasta que el cliente active premium)
 *   - lang:         "es-MX"
 */

import { useCallback, useState } from "react";
import type { VoiceSettings } from "@/components/copilot/voice/VoiceSettingsPanel";

const STORAGE_KEY = "aria-voice-settings";

const DEFAULT_SETTINGS: VoiceSettings = {
  inputEnabled: true,
  autoSpeak: false,
  premiumTTS: false,
  lang: "es-MX",
};

function readSettings(): VoiceSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(s: VoiceSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // sessionStorage puede estar deshabilitado (incógnito estricto, iOS lockdown).
  }
}

export interface UseVoiceSettingsResult {
  settings: VoiceSettings;
  setSettings: (next: VoiceSettings) => void;
  /** Convenience: update solo un campo sin reescribir el objeto entero. */
  patch: (partial: Partial<VoiceSettings>) => void;
}

export function useVoiceSettings(): UseVoiceSettingsResult {
  // Lazy initializer lee sessionStorage solo en el cliente. En SSR
  // `readSettings()` regresa defaults (typeof window check interno).
  // Esto evita un setState-en-effect que dispararía cascading renders.
  // Si en SSR hidratamos con defaults y en cliente sessionStorage tenía
  // valores distintos, React detecta el mismatch en hydration y la app
  // queda en el valor correcto en el siguiente render — aceptable porque
  // esto es UI de settings (no afecta SEO ni contenido crítico).
  const [settings, setSettingsState] = useState<VoiceSettings>(() =>
    readSettings(),
  );

  const setSettings = useCallback((next: VoiceSettings) => {
    setSettingsState(next);
    writeSettings(next);
  }, []);

  const patch = useCallback((partial: Partial<VoiceSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial };
      writeSettings(next);
      return next;
    });
  }, []);

  return { settings, setSettings, patch };
}
