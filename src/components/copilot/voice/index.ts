/**
 * Barrel de la capa de voz de ARIA Copilot.
 *
 * Importar desde el AriaCopilot principal:
 *
 *   import {
 *     MicButton,
 *     SpeakerToggle,
 *     SpeakMessageButton,
 *     VoiceWaveform,
 *     VoiceSettingsPanel,
 *   } from "@/components/copilot/voice";
 *
 *   import { useVoiceInput } from "@/lib/hooks/useVoiceInput";
 *   import { useVoiceOutput } from "@/lib/hooks/useVoiceOutput";
 *   import { useVoiceSettings } from "@/lib/hooks/useVoiceSettings";
 *
 * Ver `AriaVoiceIntegration.tsx` para un wrapper plug-and-play que junta
 * todo (input + output + settings) y expone una API minimal al copiloto.
 */

export { MicButton } from "./MicButton";
export { SpeakerToggle } from "./SpeakerToggle";
export { SpeakMessageButton } from "./SpeakMessageButton";
export { VoiceWaveform } from "./VoiceWaveform";
export { VoiceSettingsPanel } from "./VoiceSettingsPanel";
export type { VoiceSettings } from "./VoiceSettingsPanel";
