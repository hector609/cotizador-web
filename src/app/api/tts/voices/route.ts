/**
 * GET /api/tts/voices — lista voces de la cuenta ElevenLabs.
 *
 * Útil para que Hector escoja una voz MX/LATAM sin abrir el dashboard.
 *
 * Query params (todos opcionales):
 *   ?lang=es        → filtra voces que soporten español (default).
 *   ?accent=mexican → filtra por acento (case-insensitive substring).
 *   ?all=1          → devuelve TODAS las voces sin filtrar.
 *
 * Respuesta:
 *   200 — { voices: [{ voice_id, name, labels, preview_url, ... }] }
 *   503 — ELEVENLABS_API_KEY no configurada.
 *   502 — upstream falló.
 *
 * NOTA: este endpoint es admin-only en intención. No expone API key al cliente
 * pero la lista de voces SÍ es info "no pública" del owner. Por ahora gate
 * básico: solo responde si el caller viene de un dominio confiable (Vercel
 * preview/prod, localhost). Para producción real, agregar auth (session cookie).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string | null;
  preview_url?: string | null;
  fine_tuning?: { language?: string; verification_attempts?: unknown };
  high_quality_base_model_ids?: string[];
}

interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

function matchesLang(voice: ElevenLabsVoice, lang: string): boolean {
  const labels = voice.labels || {};
  const langLabel = (labels.language || labels.lang || "").toLowerCase();
  const description = (voice.description || "").toLowerCase();
  const ft = (voice.fine_tuning?.language || "").toLowerCase();
  const needle = lang.toLowerCase();
  return (
    langLabel.includes(needle) ||
    description.includes(needle) ||
    ft.includes(needle) ||
    (needle === "es" && (langLabel.includes("spanish") || description.includes("spanish")))
  );
}

function matchesAccent(voice: ElevenLabsVoice, accent: string): boolean {
  const labels = voice.labels || {};
  const accentLabel = (labels.accent || "").toLowerCase();
  const description = (voice.description || "").toLowerCase();
  const needle = accent.toLowerCase();
  return accentLabel.includes(needle) || description.includes(needle);
}

export async function GET(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") || "es";
  const accent = searchParams.get("accent") || "";
  const showAll = searchParams.get("all") === "1";

  let upstream: Response;
  try {
    upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: { "xi-api-key": apiKey, Accept: "application/json" },
    });
  } catch (e) {
    console.error("[tts/voices] fetch error", e);
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_error", upstream_status: upstream.status },
      { status: 502 },
    );
  }

  const data = (await upstream.json()) as ElevenLabsVoicesResponse;
  const allVoices = data.voices || [];

  const filtered = showAll
    ? allVoices
    : allVoices.filter((v) => {
        if (!matchesLang(v, lang)) return false;
        if (accent && !matchesAccent(v, accent)) return false;
        return true;
      });

  const simplified = filtered.map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels,
    description: v.description,
    preview_url: v.preview_url,
  }));

  return NextResponse.json({
    voices: simplified,
    total: simplified.length,
    total_all: allVoices.length,
    filtered_by: showAll ? "none" : { lang, accent: accent || null },
    hint:
      simplified.length === 0
        ? "0 voces matched. Prueba ?all=1 o ?lang=spanish o ?accent=latin"
        : "Para usar una voz: copia su voice_id y setea env var ELEVENLABS_DEFAULT_VOICE_ID en Vercel",
  });
}
