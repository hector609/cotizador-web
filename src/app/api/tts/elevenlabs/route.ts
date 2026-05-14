/**
 * POST /api/tts/elevenlabs — proxy server-side a ElevenLabs Text-to-Speech.
 *
 * El cliente (componente AriaCopilot via `useVoiceOutput`) llama acá para
 * convertir respuestas de ARIA en audio MP3. Este endpoint envuelve la
 * API key (`ELEVENLABS_API_KEY`) que NO puede exponerse al browser.
 *
 * Body JSON:
 *   {
 *     text: string,              // requerido. Max 5000 chars.
 *     voice_id?: string,         // override voz; default Adam (MX placeholder).
 *     model_id?: string,         // override modelo; default eleven_multilingual_v2.
 *   }
 *
 * Respuesta exitosa:
 *   200 — body = stream `audio/mpeg` (MP3). Cliente lo reproduce con <audio>.
 *
 * Errores:
 *   400 — body inválido / text vacío / text excede MAX_TTS_TEXT_LEN.
 *   429 — rate limited (20 req/hora por IP).
 *   503 — ELEVENLABS_API_KEY no configurada (TTS not configured).
 *   502 — upstream ElevenLabs falló (4xx/5xx).
 *
 * Sanitización: el texto pasa por `sanitizeForTTS` para quitar markdown,
 * URLs y código. Esto evita que la voz "lea" caracteres especiales como
 * "asterisco asterisco bold asterisco asterisco" — muy distracting.
 *
 * Rate limit:
 *   - In-memory Map por IP. Reset al reinicio del lambda. Best effort.
 *   - Para producción con tráfico real, migrar a Vercel KV (ver Task 3
 *     que ya creó `src/lib/rate-limit.ts` — TODO migrar este endpoint también).
 *
 * Streaming:
 *   - Devolvemos `response.body` directo de ElevenLabs como ReadableStream.
 *     El cliente recibe los primeros bytes antes de que termine la síntesis,
 *     pudiendo empezar a reproducir con `<audio>` autoplay.
 */

import { NextResponse } from "next/server";

import {
  DEFAULT_ELEVENLABS_MODEL_ID,
  DEFAULT_ELEVENLABS_VOICE_ID,
  MAX_TTS_TEXT_LEN,
  sanitizeForTTS,
} from "@/lib/tts/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 30;

const ELEVENLABS_TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";

// --- Rate limit in-memory (por IP) ---------------------------------------
// 20 requests por hora por IP. El endpoint TTS es caro ($$$ ElevenLabs) y
// no queremos que abusen del proxy. Cuando exista presupuesto real para
// caché LRU server-side, este límite se puede subir.

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const RATE_MAX_HITS = 20;

interface Bucket {
  count: number;
  resetAt: number;
}
const rateBuckets = new Map<string, Bucket>();

function rateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = rateBuckets.get(ip);
  if (!b || b.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (b.count >= RATE_MAX_HITS) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true };
}

function gcRateBuckets() {
  if (rateBuckets.size < 5000) return;
  const now = Date.now();
  for (const [ip, b] of rateBuckets.entries()) {
    if (b.resetAt < now) rateBuckets.delete(ip);
  }
}

function getIp(request: Request): string {
  const h = request.headers;
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

// --- Body parsing --------------------------------------------------------

interface TTSRequestBody {
  text?: unknown;
  voice_id?: unknown;
  model_id?: unknown;
}

// --- Handler -------------------------------------------------------------

function errJson(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status });
}

export async function POST(request: Request) {
  // 0. API key gate.
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return errJson("TTS not configured", 503);
  }

  // 1. Rate limit por IP.
  gcRateBuckets();
  const ip = getIp(request);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return errJson("rate_limited", 429, { retry_after: rl.retryAfter });
  }

  // 2. Parse body.
  let body: TTSRequestBody;
  try {
    body = (await request.json()) as TTSRequestBody;
  } catch {
    return errJson("Datos inválidos. Verifica los campos e intenta de nuevo.", 400);
  }

  const rawText = typeof body.text === "string" ? body.text : "";
  if (!rawText.trim()) {
    return errJson("`text` requerido", 400);
  }
  if (rawText.length > MAX_TTS_TEXT_LEN) {
    return errJson(`text excede ${MAX_TTS_TEXT_LEN} caracteres`, 400);
  }

  // 3. Sanitiza para TTS (markdown/URLs/código → prosa plana).
  const cleanText = sanitizeForTTS(rawText);
  if (!cleanText) {
    return errJson("text vacío tras sanitización", 400);
  }

  const voiceId =
    typeof body.voice_id === "string" && body.voice_id.trim()
      ? body.voice_id.trim()
      : DEFAULT_ELEVENLABS_VOICE_ID;
  const modelId =
    typeof body.model_id === "string" && body.model_id.trim()
      ? body.model_id.trim()
      : DEFAULT_ELEVENLABS_MODEL_ID;

  // 4. Llamar ElevenLabs.
  const url = `${ELEVENLABS_TTS_ENDPOINT}/${encodeURIComponent(voiceId)}`;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });
  } catch (e) {
    console.error("[tts/elevenlabs] fetch error", e);
    return errJson("upstream_unreachable", 502);
  }

  if (!upstream.ok) {
    let detail = `HTTP ${upstream.status}`;
    try {
      const json = (await upstream.json()) as {
        detail?: { message?: string } | string;
      };
      if (typeof json.detail === "string") detail = json.detail;
      else if (json.detail?.message) detail = json.detail.message;
    } catch {
      // body no era JSON; mantenemos el status.
    }
    console.error("[tts/elevenlabs] upstream error", upstream.status, detail);
    return errJson("upstream_error", 502, {
      upstream_status: upstream.status,
      detail: detail.slice(0, 200),
    });
  }

  if (!upstream.body) {
    return errJson("upstream_empty_body", 502);
  }

  // 5. Stream audio/mpeg al cliente.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
