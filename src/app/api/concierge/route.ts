import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * POST /api/concierge — chat público "Aria" para visitantes pre-login.
 *
 * Objetivo: responder preguntas frecuentes del landing (precios, demo,
 * planes que cotiza, persona física vs moral) sin obligar a registrarse.
 * No proxy al bot — backend separado, Claude Haiku (cheapest) con system
 * prompt FAQ acotado. Concebido como funnel: tras 2-3 turnos sugerimos
 * /signup.
 *
 * Contrato:
 *   Request:  { messages: Array<{ role: "user" | "assistant", content: string }> }
 *   Response: text/event-stream (SSE-style chunks)
 *             - event message data: { delta: string }
 *             - event done data: { stop_reason }
 *             - event error data: { error: string }
 *
 * Validaciones:
 *   - Máximo 20 mensajes / 8000 chars totales en el historial.
 *   - Cada `content` ≤ 2000 chars, role ∈ {user, assistant}.
 *   - Último mensaje DEBE ser role=user (sino 400).
 *
 * Rate limit: 30 mensajes / 10 minutos por IP. In-memory Map (reset al
 * reinicio del lambda — aceptable para un widget público pre-MVP; si
 * abusan en producción migramos a Upstash Redis).
 *
 * Privacidad: NO se persiste el thread del lado del servidor. El cliente
 * usa sessionStorage si quiere conservar el contexto entre refreshes.
 *
 * SECURITY:
 *   - ANTHROPIC_API_KEY se lee de env var; si no existe → 503.
 *   - System prompt acotado: el modelo NO tiene tools, NO accede a datos
 *     del tenant. Si la pregunta es específica del cliente sugiere signup.
 *   - Sanitizamos IP de headers proxy: x-real-ip > x-forwarded-for[0] >
 *     cf-connecting-ip > "unknown".
 */

export const runtime = "nodejs";
// El streaming SSE requiere que la función no termine antes de tiempo.
// Aceptamos hasta 25s — suficiente para respuestas Haiku de 4 líneas.
export const maxDuration = 30;

// -- Config -------------------------------------------------------------

const MODEL = process.env.CONCIERGE_MODEL || "claude-haiku-4-5";
const MAX_MESSAGES = 20;
const MAX_CONTENT_LEN = 2000;
const MAX_TOTAL_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 400;

const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 min
const RATE_MAX_HITS = 30;

const SYSTEM_PROMPT = `Eres Aria, asistente virtual del cotizador Hectoria — una herramienta SaaS para distribuidores autorizados Telcel (DATs) en México.

Tu rol: responder dudas de visitantes que llegaron al landing y están evaluando si registrarse. Sé concisa, amable y honesta.

INFORMACIÓN VERIFICADA QUE PUEDES COMPARTIR:
- Precios: plan gratuito para empezar (sin tarjeta), Pro $299/mes (toggle anual 15% off), Empresa $999/mes con onboarding custom.
- No requiere tarjeta para registrarse ni para probar la demo.
- Cotiza planes Telcel Empresa, Negocio, Plus y Corporativo (tarifas oficiales del portal Telcel B2B).
- Tiempo: 2-3 minutos por cotización vs ~1.5h con Excel manual.
- Soporta persona física (solo CAMBIO DE PLAN) y persona moral (ACTIVACIÓN y RENOVACIÓN).
- Genera dos PDFs descargables: uno para el cliente final y uno interno con margen real.
- Multi-usuario: cada vendedor entra con sus credenciales y el admin ve el histórico consolidado.

REGLAS ESTRICTAS:
- NO inventes números, descuentos, equipos, integraciones, ni features que no estén arriba. Si no sabes, dilo.
- Si la pregunta requiere datos del tenant ("¿cuál es mi cotización?", "¿cuánto me cobraron?") sugiere registrarse o contactar a Hector vía Telegram.
- Si preguntan por algo no relacionado al cotizador, redirige amable al producto.
- Idioma: español de México (tú formal, no "vos"). Tono cordial, profesional, breve.
- Máximo 4 líneas por respuesta. Sin emojis. Sin Markdown pesado (puedes usar saltos de línea y guiones).
- Cuando sea natural, invita a probar la demo: "Puedes crear cuenta gratis y probarlo en 2 minutos."`;

// -- Rate limit en memoria ---------------------------------------------

type Bucket = { count: number; resetAt: number };
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

// GC ligero para no acumular IPs viejas para siempre.
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

// -- Tipos --------------------------------------------------------------

type Role = "user" | "assistant";
interface InMessage {
  role: Role;
  content: string;
}
interface RequestBody {
  messages?: unknown;
}

function isMessage(x: unknown): x is InMessage {
  if (!x || typeof x !== "object") return false;
  const m = x as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string"
  );
}

// -- Handler ------------------------------------------------------------

function errJson(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status });
}

export async function POST(request: Request) {
  // 0. API key gate. Falla rápido y limpio para no quemar invocaciones.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[concierge] ANTHROPIC_API_KEY no configurada");
    return errJson("Servicio no disponible", 503);
  }

  // 1. Rate limit por IP.
  gcRateBuckets();
  const ip = getIp(request);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return errJson("rate_limited", 429, { retry_after: rl.retryAfter });
  }

  // 2. Parse + validación.
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return errJson("JSON inválido", 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return errJson("Campo `messages` requerido", 400);
  }
  if (body.messages.length > MAX_MESSAGES) {
    return errJson(`Máximo ${MAX_MESSAGES} mensajes`, 400);
  }

  const messages: InMessage[] = [];
  let totalChars = 0;
  for (const raw of body.messages) {
    if (!isMessage(raw)) return errJson("Mensaje con formato inválido", 400);
    const content = raw.content.trim();
    if (!content) continue; // ignoramos mensajes vacíos silenciosamente
    if (content.length > MAX_CONTENT_LEN) {
      return errJson(`Mensaje excede ${MAX_CONTENT_LEN} caracteres`, 400);
    }
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return errJson(`Historial excede ${MAX_TOTAL_CHARS} caracteres`, 400);
    }
    messages.push({ role: raw.role, content });
  }

  if (messages.length === 0) return errJson("messages vacío", 400);
  if (messages[messages.length - 1].role !== "user") {
    return errJson("Último mensaje debe ser del usuario", 400);
  }

  // 3. Llamar Anthropic con streaming.
  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const upstream = await client.messages.stream({
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          messages,
        });

        for await (const event of upstream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send("message", { delta: event.delta.text });
          }
        }

        const final = await upstream.finalMessage();
        send("done", { stop_reason: final.stop_reason ?? "end_turn" });
      } catch (e) {
        console.error("[concierge] anthropic stream error", e);
        const msg =
          e instanceof Error ? e.message.slice(0, 200) : "stream_error";
        send("error", { error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
