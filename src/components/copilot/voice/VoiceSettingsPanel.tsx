"use client";

/**
 * VoiceSettingsPanel — popover dentro del gear icon de ARIA Copilot.
 * Permite al usuario configurar voz I/O sin tocar código.
 *
 * Opciones expuestas:
 *   - Voz input (mic) ON/OFF — default ON.
 *   - Auto-speak respuestas ON/OFF — default OFF (para no asustar al
 *     usuario la primera vez).
 *   - Voz premium ElevenLabs ON/OFF — requiere API key configurada
 *     server-side; si no, switch deshabilitado con tooltip.
 *   - Idioma de voz — es-MX default (futuro: dropdown con MX/ES/US).
 *
 * Persistencia: el padre lee/escribe `sessionStorage`.
 */

import { motion } from "framer-motion";
import { ExternalLink, Lock } from "lucide-react";

export interface VoiceSettings {
  inputEnabled: boolean;
  autoSpeak: boolean;
  premiumTTS: boolean;
  lang: string;
}

interface VoiceSettingsPanelProps {
  settings: VoiceSettings;
  onChange: (next: VoiceSettings) => void;
  /**
   * `true` si la API key de ElevenLabs está configurada server-side
   * (chequeo via /api/tts/health). Si false, el switch premium se
   * deshabilita con candado.
   */
  premiumAvailable?: boolean;
  className?: string;
}

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-3 py-2.5 ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-900">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
        )}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          checked
            ? "bg-gradient-to-r from-indigo-500 to-cyan-500"
            : "bg-slate-200"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute h-4 w-4 rounded-full bg-white shadow-sm"
          style={{ left: checked ? "calc(100% - 18px)" : "2px" }}
        />
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
    </label>
  );
}

export function VoiceSettingsPanel({
  settings,
  onChange,
  premiumAvailable = false,
  className = "",
}: VoiceSettingsPanelProps) {
  return (
    <div
      className={`w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg ${className}`}
      role="dialog"
      aria-label="Configuración de voz"
    >
      <h3 className="mb-1 text-sm font-semibold text-slate-900">
        Configuración de voz
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        ARIA puede escucharte y responder en voz alta.
      </p>
      <div className="divide-y divide-slate-100">
        <Toggle
          label="Micrófono"
          hint="Habla en lugar de escribir"
          checked={settings.inputEnabled}
          onChange={(v) => onChange({ ...settings, inputEnabled: v })}
        />
        <Toggle
          label="Leer respuestas en voz alta"
          hint="ARIA hablará automáticamente cada respuesta"
          checked={settings.autoSpeak}
          onChange={(v) => onChange({ ...settings, autoSpeak: v })}
        />
        <Toggle
          label="Voz premium (ElevenLabs)"
          hint={
            premiumAvailable
              ? "Voz más natural — usa créditos"
              : "Requiere ELEVENLABS_API_KEY configurada"
          }
          disabled={!premiumAvailable}
          checked={settings.premiumTTS && premiumAvailable}
          onChange={(v) => onChange({ ...settings, premiumTTS: v })}
        />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          Idioma: <strong className="text-slate-700">{settings.lang}</strong>
        </span>
        {!premiumAvailable && (
          <a
            href="https://elevenlabs.io/docs/api-reference/text-to-speech"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
          >
            <Lock size={10} /> Activar premium <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}
