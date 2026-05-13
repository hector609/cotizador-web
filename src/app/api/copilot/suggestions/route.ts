/**
 * POST /api/copilot/suggestions — Aria CoPilot tips contextuales para /cotizar.
 *
 * Concepto:
 *   Endpoint NO-STREAM (respuesta corta JSON) que mira un snapshot del estado
 *   actual del chat de cotización y devuelve 0-2 sugerencias accionables.
 *   El frontend (`useAriaCoPilot` hook) lo llama tras cambios significativos
 *   en `draft`, `lastResult` o `idleMs`, y renderiza las suggestions como
 *   cards en el side-panel `<AriaCoPilot/>` al costado del chat.
 *
 * Body (POST):
 *   {
 *     rfc?: string,
 *     perfiles?: number,
 *     plan?: string,
 *     tramite?: string,            // "ACTIVACION" | "RENOVACION" | "CAMBIO PLAN"
 *     plazo?: number,              // meses
 *     draft?: string,              // texto crudo en el composer
 *     lastABResult?: number | null,// rentabilidad % de la última cotización
 *     idleMs?: number              // ms desde la última escritura en composer
 *   }
 *
 * Respuesta (200):
 *   {
 *     suggestions: [
 *       {
 *         id: string,
 *         level: "info" | "warn" | "action",
 *         title: string,
 *         body: string,
 *         action?: { label: string, callback_id: string, params?: object }
 *       }
 *     ]
 *   }
 *
 * Auth:
 *   - Requiere cookie `session` (igual que /api/copilot global). Devuelve 401
 *     sin sesión.
 *
 * Rate limit:
 *   - 30 req / 10 min por vendedor_id (in-memory). 429 si excede.
 *
 * Modelo:
 *   - claude-haiku-4-5-20251001 (rápido + barato; respuesta corta JSON-only).
 *   - max_tokens 512; output JSON estricto (parseamos defensivamente).
 *
 * Heurísticas server-side (pre-LLM):
 *   Antes de llamar al modelo, se ejecuta una pasada de reglas determinísticas
 *   que NO necesitan IA (RFC 13 chars → CAMBIO PLAN, VPN + ACTIVACION ilegal,
 *   etc.). Esto garantiza latencia <50ms para los triggers obvios y reduce
 *   costo. El modelo solo se invoca si la pasada local no encuentra nada o
 *   si hay un resultado A/B con suficiente contexto para razonar.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getSessionFromRequest } from "@/lib/auth";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const COPILOT_MODEL =
  process.env.COPILOT_MODEL || "claude-haiku-4-5-20251001";

// --- Rate limit (in-memory, user-scoped) ---
interface RateBucket {
  count: number;
  resetAt: number;
}
const rateBuckets = new Map<string, RateBucket>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function rateLimitCheck(userId: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

// --- Types ---
export type SuggestionLevel = "info" | "warn" | "action";

export interface AriaSuggestion {
  id: string;
  level: SuggestionLevel;
  title: string;
  body: string;
  action?: {
    label: string;
    callback_id: string;
    params?: Record<string, unknown>;
  };
}

interface SuggestionsRequestBody {
  rfc?: string;
  perfiles?: number;
  plan?: string;
  tramite?: string;
  plazo?: number;
  draft?: string;
  lastABResult?: number | null;
  idleMs?: number;
}

// --- Heurísticas determinísticas (sin IA) ---
//
// El orden importa: devolvemos como máximo 2 sugerencias, así que las reglas
// más críticas (errores estructurales) van primero.

const RFC_PERSONA_FISICA_LEN = 13;
const RFC_PERSONA_MORAL_LEN = 12;
const LOW_AB_THRESHOLD = 15; // %
const HIGH_AB_THRESHOLD = 35; // %
const IDLE_HINT_MS = 3 * 60 * 1000; // 3 min sin escribir

function detectRfcInText(text: string): string | null {
  // Match RFC mexicano: 3-4 letras + 6 digitos + 3 alfanuméricos
  const m = text.toUpperCase().match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/);
  return m ? m[0] : null;
}

function ruleBasedSuggestions(body: SuggestionsRequestBody): AriaSuggestion[] {
  const out: AriaSuggestion[] = [];
  const draft = (body.draft || "").trim();
  const tramite = (body.tramite || "").toUpperCase();
  const plan = (body.plan || "").toUpperCase();
  const ab = typeof body.lastABResult === "number" ? body.lastABResult : null;

  // Detectar RFC: si llega explícito úsalo, sino sniff del draft.
  const rfcExplicit = body.rfc ? body.rfc.trim().toUpperCase() : "";
  const rfcFromDraft = !rfcExplicit ? detectRfcInText(draft) : null;
  const rfc = rfcExplicit || rfcFromDraft || "";

  // Trigger 1 — RFC 13 chars (persona física) + tramite NO es CAMBIO PLAN.
  // Telcel: persona física solo puede CAMBIO PLAN, no ACTIVACION.
  if (rfc.length === RFC_PERSONA_FISICA_LEN) {
    const wrongTramite =
      tramite && tramite !== "CAMBIO PLAN" && tramite !== "CAMBIO_PLAN";
    if (wrongTramite || !tramite) {
      out.push({
        id: "rfc-persona-fisica-tramite",
        level: "action",
        title: "Detecté persona física",
        body: `El RFC ${rfc} es persona física (13 chars). Telcel solo acepta trámite **CAMBIO PLAN** para personas físicas, no ACTIVACION nueva.`,
        action: {
          label: "Sí, corregir a CAMBIO PLAN",
          callback_id: "set_tramite",
          params: { tramite: "CAMBIO PLAN" },
        },
      });
    }
  }

  // Trigger 2 — Plan VPN + tramite ACTIVACION (combo ilegal en Telcel).
  if (plan.includes("VPN") && (tramite === "ACTIVACION" || draft.toUpperCase().includes("ACTIVACION"))) {
    out.push({
      id: "vpn-activacion-ilegal",
      level: "warn",
      title: "VPN no acepta activación nueva",
      body: "Los planes VPN solo aceptan **RENOVACION** o **CAMBIO PLAN**, no activación. Cambia el trámite antes de enviar.",
      action: {
        label: "Cambiar a RENOVACION",
        callback_id: "set_tramite",
        params: { tramite: "RENOVACION" },
      },
    });
  }

  // Triggers 3 y 4 — última cotización con A/B baja o alta.
  if (ab !== null && Number.isFinite(ab)) {
    if (ab < LOW_AB_THRESHOLD) {
      out.push({
        id: "ab-baja",
        level: "warn",
        title: "Rentabilidad baja",
        body: `Tu A/B es ${ab.toFixed(1)}% (umbral sano: 15%+). Considera cotizar **multi-perfil** agregando 2 líneas más para amortizar el costo del equipo.`,
        action: {
          label: "Cotizar multi-perfil (+2 líneas)",
          callback_id: "compose_multiperfil",
          params: { lineas_extra: 2 },
        },
      });
    } else if (ab > HIGH_AB_THRESHOLD) {
      out.push({
        id: "ab-alta",
        level: "info",
        title: "Excelente A/B",
        body: `${ab.toFixed(1)}% está sobre el promedio del mes. ¿Aplicas una palanca (meses gratis o descuento) para hacer la oferta más atractiva al cliente?`,
        action: {
          label: "Abrir Optimizar palancas",
          callback_id: "navigate",
          params: { path: "/dashboard/optimizar" },
        },
      });
    }
  }

  // Trigger 5 — Usuario lleva +3min en composer sin enviar.
  if (
    typeof body.idleMs === "number" &&
    body.idleMs >= IDLE_HINT_MS &&
    out.length === 0
  ) {
    out.push({
      id: "idle-help",
      level: "info",
      title: "¿Necesitas ayuda?",
      body: "Cuéntame qué cliente y plan quieres y te ayudo a redactarlo. Ejemplo: 'XAXX010101000, 5 líneas, plan EMPRESA 500, iPhone 15'.",
      action: {
        label: "Insertar plantilla",
        callback_id: "compose_template",
        params: {
          text: "RFC: \nLíneas: \nPlan: \nEquipo: ",
        },
      },
    });
  }

  // Cap a 2 sugerencias para no abrumar.
  return out.slice(0, 2);
}

// --- LLM enriquecimiento (opcional, cuando heurísticas no encuentran nada) ---

const SYSTEM_PROMPT_LLM = `Eres **Aria**, copiloto del cotizador Hectoria para distribuidores Telcel.

Analizas el ESTADO ACTUAL del chat de cotización y produces 0-2 sugerencias accionables, cortas y útiles. Tono: cordial, conciso, español MX.

REGLAS DE NEGOCIO:
- RFC 13 chars = persona física → solo CAMBIO PLAN.
- RFC 12 chars = persona moral → ACTIVACION ok.
- Planes VPN no aceptan ACTIVACION nueva.
- A/B < 15% = rentabilidad baja → sugiere multi-perfil.
- A/B > 35% = excelente → sugiere palancas para mejorar oferta.

SALIDA OBLIGATORIA (JSON puro, sin markdown):
{
  "suggestions": [
    {
      "id": "<slug-corto>",
      "level": "info" | "warn" | "action",
      "title": "<titulo 3-6 palabras>",
      "body": "<1-2 frases accionables>",
      "action": { "label": "<label boton>", "callback_id": "navigate|set_tramite|compose_template|compose_multiperfil|apply_palanca", "params": {} }
    }
  ]
}

Si NO hay sugerencias relevantes (estado vacío o ambiguo), devuelve: {"suggestions": []}.
Máximo 2 sugerencias. NO inventes datos. NO escribas nada fuera del JSON.`;

async function llmEnrich(
  anthropic: Anthropic,
  body: SuggestionsRequestBody,
): Promise<AriaSuggestion[]> {
  const snapshot = {
    rfc: body.rfc || null,
    perfiles: body.perfiles ?? null,
    plan: body.plan || null,
    tramite: body.tramite || null,
    plazo: body.plazo ?? null,
    draft_preview: (body.draft || "").slice(0, 400),
    lastABResult: body.lastABResult ?? null,
  };

  try {
    const resp = await anthropic.messages.create({
      model: COPILOT_MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT_LLM,
      messages: [
        {
          role: "user",
          content: `Estado actual del cotizador:\n${JSON.stringify(snapshot, null, 2)}\n\nDevuelve JSON.`,
        },
      ],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Recortar a JSON puro (defensa contra prosa accidental).
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) return [];
    const raw = text.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(raw) as { suggestions?: unknown };
    if (!parsed || !Array.isArray(parsed.suggestions)) return [];

    const safe: AriaSuggestion[] = [];
    for (const s of parsed.suggestions.slice(0, 2)) {
      if (!s || typeof s !== "object") continue;
      const rec = s as Record<string, unknown>;
      const id = typeof rec.id === "string" ? rec.id.slice(0, 64) : null;
      const title = typeof rec.title === "string" ? rec.title.slice(0, 80) : null;
      const bodyTxt =
        typeof rec.body === "string" ? rec.body.slice(0, 280) : null;
      const lvl = rec.level;
      const level: SuggestionLevel =
        lvl === "warn" || lvl === "action" ? lvl : "info";
      if (!id || !title || !bodyTxt) continue;
      const action =
        rec.action && typeof rec.action === "object"
          ? (rec.action as Record<string, unknown>)
          : null;
      let actionOut: AriaSuggestion["action"] | undefined;
      if (action) {
        const label =
          typeof action.label === "string" ? action.label.slice(0, 60) : null;
        const cb =
          typeof action.callback_id === "string"
            ? action.callback_id.slice(0, 40)
            : null;
        if (label && cb) {
          actionOut = {
            label,
            callback_id: cb,
            params:
              action.params && typeof action.params === "object"
                ? (action.params as Record<string, unknown>)
                : undefined,
          };
        }
      }
      safe.push({ id, level, title, body: bodyTxt, action: actionOut });
    }
    return safe;
  } catch (e) {
    console.error("[copilot/suggestions] llm error", e);
    return [];
  }
}

// --- POST handler ---
export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userKey = String(session.vendedor_id);
  const rl = rateLimitCheck(userKey);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: "rate_limited", retry_after: rl.retryAfter }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfter ?? 60),
        },
      },
    );
  }

  let body: SuggestionsRequestBody;
  try {
    body = (await request.json()) as SuggestionsRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Sanitize sizes para que el snapshot no infle.
  const safeBody: SuggestionsRequestBody = {
    rfc: typeof body.rfc === "string" ? body.rfc.slice(0, 20) : undefined,
    perfiles:
      typeof body.perfiles === "number" && Number.isFinite(body.perfiles)
        ? body.perfiles
        : undefined,
    plan: typeof body.plan === "string" ? body.plan.slice(0, 80) : undefined,
    tramite:
      typeof body.tramite === "string" ? body.tramite.slice(0, 30) : undefined,
    plazo:
      typeof body.plazo === "number" && Number.isFinite(body.plazo)
        ? body.plazo
        : undefined,
    draft: typeof body.draft === "string" ? body.draft.slice(0, 2000) : undefined,
    lastABResult:
      typeof body.lastABResult === "number" && Number.isFinite(body.lastABResult)
        ? body.lastABResult
        : null,
    idleMs:
      typeof body.idleMs === "number" && Number.isFinite(body.idleMs)
        ? body.idleMs
        : undefined,
  };

  // Paso 1 — heurísticas determinísticas (sin LLM, latencia <50ms).
  const local = ruleBasedSuggestions(safeBody);
  if (local.length > 0) {
    return new Response(JSON.stringify({ suggestions: local }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Paso 2 — fallback LLM solo si hay contexto suficiente y key disponible.
  const hasContext =
    !!safeBody.rfc ||
    !!safeBody.plan ||
    (safeBody.draft && safeBody.draft.length > 30) ||
    safeBody.lastABResult !== null;

  if (!hasContext || !ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const enriched = await llmEnrich(anthropic, safeBody);

  return new Response(JSON.stringify({ suggestions: enriched }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
