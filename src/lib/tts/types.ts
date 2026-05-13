/**
 * TTSProvider — contrato común para proveedores de Text-to-Speech premium.
 *
 * Sirve como puerto agnóstico para que `useVoiceOutput` pueda enchufar
 * ElevenLabs, Cartesia, OpenAI TTS, Azure Cognitive Services o cualquier
 * vendor futuro sin tocar el hook. Si el provider falla, el hook hace
 * fallback al browser `speechSynthesis` (gratis y siempre disponible).
 *
 * Convención: `synthesize` devuelve un `Blob` (audio/mpeg o audio/wav).
 * El hook construye un `URL.createObjectURL(blob)` y lo reproduce con
 * un elemento `<audio>` standard — no estamos atados a Web Audio API
 * porque el caso de uso (voz de ARIA) no necesita procesamiento, solo
 * playback.
 */

export interface TTSSynthesizeOptions {
  /** BCP-47 locale (ej `es-MX`). El provider puede ignorarlo si su voz es fija. */
  lang?: string;
  /** Permite cancelar el request si el usuario presiona "Detener". */
  signal?: AbortSignal;
  /** Voice ID override (ej. ElevenLabs `21m00Tcm4TlvDq8ikWAM` Bella). */
  voiceId?: string;
}

export interface TTSProvider {
  /** Nombre legible para UI / settings ("ElevenLabs", "Cartesia"…). */
  readonly name: string;
  /**
   * `true` si el provider está listo para usarse (API key cargada,
   * red disponible, etc.). El hook lo consulta antes de cada llamada.
   */
  readonly available: boolean;
  /**
   * Convierte texto → audio Blob. Lanzar `Error` (o `AbortError`) si falla;
   * el hook hará fallback al browser nativo automáticamente.
   */
  synthesize: (text: string, options?: TTSSynthesizeOptions) => Promise<Blob>;
}
