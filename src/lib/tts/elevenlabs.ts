/**
 * ElevenLabs TTS provider — voz premium para ARIA Copilot.
 *
 * Estado: STUB listo para activar. NO instalamos `@elevenlabs/elevenlabs-js`
 * para evitar bundle bloat — el endpoint HTTP es trivial. Cuando el cliente
 * confirme presupuesto, basta con:
 *   1. Setear ELEVENLABS_API_KEY en env vars (Vercel + .env.local).
 *   2. En la UI, toggle "Voz mejorada (premium)" → activar.
 *   3. Verificar que el voiceId default suene bien en español MX
 *      (Bella `21m00Tcm4TlvDq8ikWAM` es female warm en inglés —
 *      conviene probar `Mateo` o un clone latino de la library).
 *
 * SEGURIDAD: nunca exponer ELEVENLABS_API_KEY al cliente. Este módulo está
 * diseñado para correr SOLO desde un endpoint Next.js server-side (e.g.
 * `app/api/tts/elevenlabs/route.ts`). El componente AriaCopilot debe llamar
 * a NUESTRO endpoint (que reenvía a ElevenLabs), no a ElevenLabs directo.
 *
 * Pricing referencial (al cierre 2026-05): Starter $5 USD / 30k chars/mes.
 * Cada respuesta de ARIA promedia ~300 chars → ~100 respuestas/mes para
 * el plan barato. Para producción con N usuarios, escalar a Creator.
 *
 * TODO antes de prod:
 *   - [ ] Crear endpoint `app/api/tts/elevenlabs/route.ts` que envuelva esta función.
 *   - [ ] Implementar caché LRU server-side (texto → audio blob hash) para
 *         no quemar chars cuando ARIA repite mensajes idénticos.
 *   - [ ] Rate-limit por sesión (max 50 reqs/min/usuario).
 *   - [ ] Probar voiceId latino (no Bella inglés) — pedir sample a Hector.
 *   - [ ] Métricas de uso: chars facturados/día en Vercel logs.
 */

import type { TTSProvider, TTSSynthesizeOptions } from "./types";

const ELEVENLABS_TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";

/**
 * Voice ID default — RESOLUCIÓN POR PRIORIDAD:
 *   1. `options.voiceId` del request (override por llamada).
 *   2. `process.env.ELEVENLABS_DEFAULT_VOICE_ID` (set en Vercel env vars).
 *   3. `FALLBACK_VOICE_ID` (Adam — único voice_id 100% verificable en docs
 *      públicas de ElevenLabs, hablará español con eleven_multilingual_v2
 *      aunque con acento neutro/no-latino).
 *
 * Para activar voz MX REAL:
 *   a) Crea cuenta en https://elevenlabs.io con plan Starter ($5/mes).
 *   b) Busca voz en https://elevenlabs.io/voice-library filtrando:
 *      - Language: Spanish
 *      - Accent: Mexican / Latin American
 *      - Recomendados: "Mateo" (masc), "Valentina" (fem), "Carolina" (fem).
 *   c) "Add to VoiceLab" → copia el voice_id (formato `XXXXXXXX...`).
 *   d) En Vercel: `vercel env add ELEVENLABS_DEFAULT_VOICE_ID` →
 *      pega voice_id → Production + Preview + Development.
 *   e) Redeploy. El default queda como la voz MX sin tocar código.
 *
 * También puedes hacer GET /api/tts/voices (con auth) para listar las voces
 * disponibles en TU cuenta filtradas por idioma español.
 */
const FALLBACK_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam — verificable, neutro

export const DEFAULT_ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim() || FALLBACK_VOICE_ID;

/**
 * Modelo. `eleven_multilingual_v2` soporta español con buena prosodia.
 * `eleven_turbo_v2_5` es más rápido (~300ms TTFB) pero un poco menos
 * expresivo — buen tradeoff para conversación en tiempo real.
 */
export const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_MODEL_ID = DEFAULT_ELEVENLABS_MODEL_ID;

/** Hard cap de longitud del texto a sintetizar. Más allá de esto el cliente
 *  debe partir el texto o resumir. 5000 chars ≈ 5 min de audio. */
export const MAX_TTS_TEXT_LEN = 5000;

/**
 * Sanitiza un texto markdown/rich → prosa plana apta para TTS.
 *
 * Quitar:
 *  - URLs (las máquinas no las pronuncian bien).
 *  - Bloques de código (``` ... ``` y `inline`).
 *  - Imágenes ![alt](url) y links [text](url) — preserva el texto si lo hay.
 *  - Headings markdown (#, ##, ###).
 *  - Énfasis (*bold*, _italics_).
 *  - HTML tags simples (<br>, <p>, <span>...).
 *  - Whitespace excesivo.
 *
 * Mantener: signos de puntuación normales (la prosodia los aprovecha).
 *
 * NO intenta ser un parser markdown completo — es best-effort para conversión
 * a voz. Si el caller necesita algo más fino debe sanitizar él mismo y pasar
 * el texto ya plano.
 */
export function sanitizeForTTS(input: string): string {
  if (!input) return "";
  let s = input;

  // 1. Fenced code blocks ``` ... ``` (multi-línea). Antes que inline `` para
  //    no romper el contenido de los bloques.
  s = s.replace(/```[\s\S]*?```/g, " ");
  // 2. Inline code `...`.
  s = s.replace(/`[^`\n]*`/g, " ");
  // 3. Imágenes ![alt](url) → quitar entero (alt rara vez aporta TTS-wise).
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  // 4. Links [texto](url) → conservar `texto`.
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  // 5. URLs sueltas (http/https/www).
  s = s.replace(/https?:\/\/\S+/gi, " ");
  s = s.replace(/\bwww\.\S+/gi, " ");
  // 6. HTML tags simples (<br>, <p>, </span>, etc).
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, " ");
  // 7. Headings ATX al inicio de línea: `# `, `## `, etc.
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // 8. Énfasis markdown: **bold**, *italic*, __bold__, _italic_.
  //    Quitamos solo los marcadores; el texto se conserva.
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1$2");
  // 9. Blockquotes `> ` al inicio de línea.
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  // 10. Listas: bullets `- `, `* `, `+ ` y numeradas `1. ` al inicio de línea.
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, "");
  s = s.replace(/^\s{0,3}\d+\.\s+/gm, "");
  // 11. Whitespace excesivo (líneas en blanco múltiples + spaces).
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

export interface ElevenLabsClientOptions {
  /** API key de ElevenLabs. NO se expone al cliente. */
  apiKey: string;
  /** Voice ID. Default Bella. */
  voiceId?: string;
  /** Model ID. Default `eleven_multilingual_v2`. */
  modelId?: string;
}

/**
 * Función pura para llamar a la API HTTP de ElevenLabs.
 *
 * @returns Blob de audio (`audio/mpeg`).
 * @throws Error con mensaje legible si el request falla (4xx/5xx/network).
 */
export async function speakWithElevenLabs(
  text: string,
  opts: ElevenLabsClientOptions & TTSSynthesizeOptions,
): Promise<Blob> {
  const {
    apiKey,
    voiceId = DEFAULT_ELEVENLABS_VOICE_ID,
    modelId = DEFAULT_MODEL_ID,
    signal,
  } = opts;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY no configurada");
  }
  if (!text.trim()) {
    throw new Error("Texto vacío");
  }

  const url = `${ELEVENLABS_TTS_ENDPOINT}/${encodeURIComponent(voiceId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
    signal,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const json = (await res.json()) as { detail?: { message?: string } | string };
      if (typeof json.detail === "string") detail = json.detail;
      else if (json.detail?.message) detail = json.detail.message;
    } catch {
      // Body no era JSON; nos quedamos con el status.
    }
    throw new Error(`ElevenLabs TTS falló: ${detail}`);
  }

  return await res.blob();
}

/**
 * Factory que produce un `TTSProvider` consumible por `useVoiceOutput`.
 *
 * Uso TÍPICO desde el componente (después de crear el endpoint server-side):
 *
 *   const provider = useMemo(
 *     () => createElevenLabsProvider({ proxyUrl: "/api/tts/elevenlabs" }),
 *     [],
 *   );
 *   const voice = useVoiceOutput({ provider });
 *
 * Donde `/api/tts/elevenlabs` es nuestro Next.js route handler que envuelve
 * `speakWithElevenLabs` con la API key del server.
 */
export interface ElevenLabsProviderOptions {
  /**
   * URL del proxy server-side que envuelve la API key. Default
   * `/api/tts/elevenlabs`. Si el endpoint no existe (estado actual),
   * `available` será false hasta que se cree.
   */
  proxyUrl?: string;
  /** Voice ID a usar. Default Bella. */
  voiceId?: string;
  /**
   * `true` si confirmamos que el endpoint existe + la API key está cargada.
   * El caller debe setearlo según su check (ej. fetching `/api/tts/health`).
   * Default `false` — el provider se marca como no disponible y el hook
   * usa el browser nativo.
   */
  available?: boolean;
}

export function createElevenLabsProvider(
  options: ElevenLabsProviderOptions = {},
): TTSProvider {
  const {
    proxyUrl = "/api/tts/elevenlabs",
    voiceId = DEFAULT_ELEVENLABS_VOICE_ID,
    available = false,
  } = options;

  return {
    name: "ElevenLabs",
    available,
    async synthesize(text, synthOpts) {
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceId: synthOpts?.voiceId ?? voiceId,
          lang: synthOpts?.lang,
        }),
        signal: synthOpts?.signal,
      });
      if (!res.ok) {
        throw new Error(`ElevenLabs proxy falló: HTTP ${res.status}`);
      }
      return await res.blob();
    },
  };
}
