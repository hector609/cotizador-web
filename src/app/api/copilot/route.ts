/**
 * POST /api/copilot — ARIA Copilot agent (post-auth, dashboard-only).
 *
 * Body:
 *   {
 *     messages: [{ role: "user"|"assistant", content: string }, ...],
 *     pageContext: { pathname: string, visibleData?: Record<string, unknown> }
 *   }
 *
 * Auth:
 *   - Requiere cookie `session` válida (HMAC-firmada por /api/auth/telegram).
 *   - El upstream a `/api/cotizaciones` y `/api/clientes` se vuelve a firmar
 *     con X-Auth dentro de las herramientas read-only.
 *
 * Rate limit:
 *   - 60 msgs / 10 min POR USER (vendedor_id). Vercel KV (Upstash Redis) via
 *     `src/lib/rate-limit.ts`. Si `KV_REST_API_URL` no está en env, el helper
 *     hace fail-open (no bloquea) — útil para dev local sin KV.
 *
 * Streaming:
 *   - Server-Sent Events (SSE). El cliente parsea `data: <json>\n\n` y
 *     reacciona a eventos:
 *       - { type: "delta", text: "..." }                — token de Claude
 *       - { type: "tool_use", name: "...", input: {} }  — write tool → frontend
 *       - { type: "tool_result", name: "...", data: {} } — read tool resuelto server-side
 *       - { type: "done" }                              — fin
 *       - { type: "error", message: "..." }             — error fatal
 *
 * Tools:
 *   READ (server-side, devuelven data en el stream):
 *     - search_cotizaciones(filters) → /api/cotizaciones GET
 *     - search_clientes(query)       → /api/clientes GET
 *     - get_kpis(period)             → derivado de /api/cotizaciones (sin endpoint dedicado aún)
 *   WRITE (emit-to-frontend, NO se ejecutan server-side):
 *     - navigate_to(path)
 *     - apply_palanca(tipo, valor)
 *
 * Modelo: claude-haiku-4-5-20251001 (rápido + barato, ~3x más rápido que sonnet).
 * TODO(model-upgrade): si la calidad cae por debajo de 80% de tareas resueltas
 * correctamente, escalar a `claude-sonnet-4-6` mediante env COPILOT_MODEL.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";
import { rateLimit } from "@/lib/rate-limit";

// --- Config ---
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const COPILOT_MODEL =
  process.env.COPILOT_MODEL || "claude-haiku-4-5-20251001";
const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";
const MAX_MESSAGES = 30; // ventana de historial enviada al modelo
const MAX_MESSAGE_LEN = 2000;
const MAX_TOOL_ITERS = 5;

// --- Rate limit (Vercel KV, user-scoped) ---
// Delegado a `src/lib/rate-limit.ts`. Si KV no está en env, fail-open.
const RATE_LIMIT = 60;
const RATE_WINDOW_SEC = 10 * 60;

// --- Types ---
interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}
interface PageContext {
  pathname?: string;
  visibleData?: Record<string, unknown>;
}
interface CopilotRequestBody {
  messages?: CopilotMessage[];
  pageContext?: PageContext;
}

// --- System prompt ---
function buildSystemPrompt(ctx: PageContext, role: string): string {
  const pathname = typeof ctx.pathname === "string" ? ctx.pathname : "/dashboard";
  const visible = ctx.visibleData
    ? `\n\nDATOS VISIBLES EN PANTALLA:\n${JSON.stringify(ctx.visibleData).slice(0, 800)}`
    : "";

  return `Eres **Aria**, la asistente IA del cotizador Hectoria para distribuidores autorizados Telcel.

CONTEXTO DEL USUARIO:
- Rol: ${role}
- Página actual: ${pathname}${visible}

QUIÉN ERES:
- Asistente integrada al producto post-login. El usuario es vendedor o admin de un distribuidor Telcel.
- Tono: cordial, conciso, accionable. Idioma: español MX.
- Conoces estos términos del producto:
  - **A/B (rentabilidad)**: porcentaje de margen.
  - **Persona física** → modalidad "CAMBIO PLAN" en Telcel.
  - **Persona moral** → modalidad "ACTIVACION".
  - **Palancas de optimización**: aportación, meses gratis, descuento, beneficio megas, tasa de interés.
  - **Folio**: ID corto de 8 chars de la cotización.

TUS HERRAMIENTAS (5):
1. \`search_cotizaciones(filters)\` — busca en el historial (read-only).
2. \`search_clientes(query)\` — busca clientes por RFC/razón social (read-only).
3. \`get_kpis(period)\` — KPIs del periodo (today|month|all) (read-only).
4. \`navigate_to(path)\` — navega al usuario a otra ruta del dashboard (WRITE: frontend ejecuta).
5. \`apply_palanca(tipo, valor)\` — aplica una palanca en /dashboard/optimizar (WRITE: frontend ejecuta).

REGLAS:
- Si el usuario pide ACCIÓN ejecutable (cotizar, ir a X, optimizar al N%), llama la tool sin pedir confirmación obvia.
- Si es PREGUNTA del producto, responde directo + sugiere ruta relevante (mención '/dashboard/cotizar' por ej).
- Si el contexto de página sugiere acción evidente (estás en /optimizar y dicen "aplica 25%"), ejecuta la tool.
- NO inventes folios, montos ni clientes. Si no tienes la data, busca con la tool.
- Responses cortas (1-3 frases) salvo que pidan detalle. Usa **negritas** sparingly.
- Si una tool falla, di qué falló y sugiere alternativa.`;
}

// --- Tools definition ---
const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_cotizaciones",
    description:
      "Busca cotizaciones del usuario en el historial. Filtros opcionales: rfc, dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD), minMonto. Devuelve hasta 20 resultados.",
    input_schema: {
      type: "object",
      properties: {
        rfc: { type: "string", description: "RFC del cliente (opcional)" },
        dateFrom: { type: "string", description: "Fecha desde YYYY-MM-DD" },
        dateTo: { type: "string", description: "Fecha hasta YYYY-MM-DD" },
        minMonto: {
          type: "number",
          description: "Monto mínimo MXN para filtrar",
        },
      },
    },
  },
  {
    name: "search_clientes",
    description:
      "Busca clientes en la cartera del distribuidor por RFC o razón social. Devuelve lista de matches.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "RFC o fragmento de razón social",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_kpis",
    description:
      "Obtiene KPIs agregados del periodo: cotizaciones, monto total, ticket promedio, A/B promedio, clientes activos.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "month", "all"],
          description: "Periodo a agregar",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "navigate_to",
    description:
      "Navega al usuario a otra ruta del dashboard (e.g. '/dashboard/cotizar', '/dashboard/historial?rfc=ABC'). El frontend ejecuta la navegación; NO devuelve resultado server-side.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Ruta destino dentro del dashboard",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "apply_palanca",
    description:
      "Aplica una palanca de optimización en /dashboard/optimizar. Tipos: aportacion, meses, descuento, beneficio, tasa. El frontend ejecuta la acción.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: ["aportacion", "meses", "descuento", "beneficio", "tasa"],
        },
        valor: {
          type: "string",
          description: "Valor a aplicar (numérico o porcentaje, e.g. '25%' o '500')",
        },
      },
      required: ["tipo", "valor"],
    },
  },
];

// --- Server-side tool executors (READ tools only) ---
async function execSearchCotizaciones(
  distribuidorId: number,
  input: Record<string, unknown>,
): Promise<unknown> {
  const params = new URLSearchParams();
  params.set("limit", "20");
  params.set("offset", "0");
  if (typeof input.dateFrom === "string") params.set("from", input.dateFrom);
  if (typeof input.dateTo === "string") params.set("to", input.dateTo);

  const auth = signBackendRequest(distribuidorId);
  const res = await fetch(`${BOT_API_URL}/api/v1/cotizaciones?${params}`, {
    headers: { ...auth, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    return { error: `Backend ${res.status}`, cotizaciones: [] };
  }
  const data = (await res.json()) as {
    cotizaciones?: Array<Record<string, unknown>>;
  };
  let rows = data.cotizaciones || [];

  // Filtros client-side defensivos para rfc/minMonto (el upstream no los soporta).
  if (typeof input.rfc === "string" && input.rfc.trim()) {
    const rfc = input.rfc.trim().toUpperCase();
    rows = rows.filter((r) =>
      typeof r.rfc === "string" && (r.rfc as string).toUpperCase().includes(rfc),
    );
  }
  if (typeof input.minMonto === "number") {
    rows = rows.filter((r) => {
      const lineas = Number(r.lineas) || 0;
      const plan = Number(r.plan) || 0;
      return lineas * plan >= (input.minMonto as number);
    });
  }
  // Trim cada cotización a campos que el modelo necesita (ahorra tokens).
  const slim = rows.slice(0, 20).map((r) => ({
    folio: typeof r.id === "string" ? (r.id as string).slice(0, 8).toUpperCase() : null,
    id: r.id,
    rfc: r.rfc,
    lineas: r.lineas,
    plan: r.plan,
    monto: (Number(r.lineas) || 0) * (Number(r.plan) || 0),
    estado: r.estado,
    created_at: r.created_at,
  }));
  return { count: slim.length, cotizaciones: slim };
}

async function execSearchClientes(
  distribuidorId: number,
  input: Record<string, unknown>,
): Promise<unknown> {
  const query =
    typeof input.query === "string" ? input.query.trim().toUpperCase() : "";
  if (!query) return { error: "query requerida", clientes: [] };
  const auth = signBackendRequest(distribuidorId);
  const res = await fetch(`${BOT_API_URL}/api/v1/clientes`, {
    headers: { ...auth, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return { error: `Backend ${res.status}`, clientes: [] };
  const data = (await res.json()) as {
    clientes?: Array<Record<string, unknown>>;
  };
  const all = data.clientes || [];
  const matches = all
    .filter((c) => {
      const rfc =
        typeof c.rfc === "string" ? (c.rfc as string).toUpperCase() : "";
      const razon =
        typeof c.razon_social === "string"
          ? (c.razon_social as string).toUpperCase()
          : "";
      return rfc.includes(query) || razon.includes(query);
    })
    .slice(0, 10);
  return { count: matches.length, clientes: matches };
}

async function execGetKpis(
  distribuidorId: number,
  input: Record<string, unknown>,
): Promise<unknown> {
  const period =
    typeof input.period === "string" ? (input.period as string) : "month";
  const auth = signBackendRequest(distribuidorId);
  const res = await fetch(
    `${BOT_API_URL}/api/v1/cotizaciones?limit=100&offset=0`,
    {
      headers: { ...auth, Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!res.ok) return { error: `Backend ${res.status}` };
  const data = (await res.json()) as {
    cotizaciones?: Array<Record<string, unknown>>;
  };
  const rows = data.cotizaciones || [];
  const now = new Date();
  const filtered = rows.filter((r) => {
    if (r.estado !== "completada") return false;
    const d = new Date(r.created_at as string);
    if (Number.isNaN(d.getTime())) return false;
    if (period === "today") {
      return (
        d.getUTCFullYear() === now.getUTCFullYear() &&
        d.getUTCMonth() === now.getUTCMonth() &&
        d.getUTCDate() === now.getUTCDate()
      );
    }
    if (period === "month") {
      return (
        d.getUTCFullYear() === now.getUTCFullYear() &&
        d.getUTCMonth() === now.getUTCMonth()
      );
    }
    return true; // all
  });
  let montoTotal = 0;
  const rfcSet = new Set<string>();
  for (const r of filtered) {
    montoTotal += (Number(r.lineas) || 0) * (Number(r.plan) || 0);
    if (typeof r.rfc === "string") rfcSet.add(r.rfc as string);
  }
  const ticketPromedio = filtered.length > 0 ? montoTotal / filtered.length : 0;
  const abPromedio =
    rows.length > 0 ? Math.round((filtered.length / rows.length) * 1000) / 10 : 0;
  return {
    period,
    cotizaciones: filtered.length,
    montoTotal: Math.round(montoTotal),
    ticketPromedio: Math.round(ticketPromedio),
    abPromedio,
    clientesActivos: rfcSet.size,
  };
}

const READ_TOOLS = new Set(["search_cotizaciones", "search_clientes", "get_kpis"]);

async function executeReadTool(
  name: string,
  distribuidorId: number,
  input: Record<string, unknown>,
): Promise<unknown> {
  try {
    if (name === "search_cotizaciones")
      return await execSearchCotizaciones(distribuidorId, input);
    if (name === "search_clientes")
      return await execSearchClientes(distribuidorId, input);
    if (name === "get_kpis") return await execGetKpis(distribuidorId, input);
    return { error: `tool desconocida: ${name}` };
  } catch (e) {
    console.error("[copilot] tool exec error", name, e);
    return { error: "tool execution failed" };
  }
}

// --- SSE helpers ---
function sseEvent(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// --- POST handler ---
export async function POST(request: Request) {
  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY no configurado" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const session = getSessionFromRequest(request);
  if (!session) {
    return new Response(JSON.stringify({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userKey = String(session.vendedor_id);
  const rl = await rateLimit(
    `aria:copilot:${userKey}`,
    RATE_LIMIT,
    RATE_WINDOW_SEC,
  );
  if (!rl.allowed) {
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

  let body: CopilotRequestBody;
  try {
    body = (await request.json()) as CopilotRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Datos inválidos. Verifica los campos e intenta de nuevo." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messagesRaw = Array.isArray(body.messages) ? body.messages : [];
  // Sanitize + cap
  const messages: CopilotMessage[] = messagesRaw
    .filter(
      (m): m is CopilotMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0 &&
        m.content.length <= MAX_MESSAGE_LEN,
    )
    .slice(-MAX_MESSAGES);

  if (messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages[] vacío o inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const pageContext: PageContext = body.pageContext || {};
  const systemPrompt = buildSystemPrompt(pageContext, session.role);

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  // We loop: model -> (maybe tool) -> model -> ... until "end_turn" or max iters.
  // For each model turn, we STREAM deltas to the SSE; for tool_use blocks, we
  // execute read-only tools server-side OR emit write-tool events to frontend.
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(obj)));

      // Conversation messages array we mutate across iterations.
      const convo: Anthropic.MessageParam[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        for (let iter = 0; iter < MAX_TOOL_ITERS; iter++) {
          const upstream = anthropic.messages.stream({
            model: COPILOT_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            tools: TOOLS,
            messages: convo,
          });

          // Collect tool_use blocks emitted in this turn (we need to act on them
          // after the turn finishes — content is finalized only at end).
          const toolUses: Array<{
            id: string;
            name: string;
            input: Record<string, unknown>;
          }> = [];

          // Stream text deltas live; tool inputs we collect from final message.
          for await (const event of upstream) {
            if (event.type === "content_block_delta") {
              const delta = event.delta as
                | { type: "text_delta"; text: string }
                | { type: "input_json_delta"; partial_json: string };
              if (delta.type === "text_delta" && delta.text) {
                send({ type: "delta", text: delta.text });
              }
              // input_json_delta accumulates inside SDK; we read from final block.
            }
          }

          const finalMessage = await upstream.finalMessage();

          // Extract tool_use blocks from finalMessage.
          for (const block of finalMessage.content) {
            if (block.type === "tool_use") {
              toolUses.push({
                id: block.id,
                name: block.name,
                input: (block.input as Record<string, unknown>) || {},
              });
            }
          }

          if (finalMessage.stop_reason !== "tool_use" || toolUses.length === 0) {
            // Conversation ended (end_turn / max_tokens / stop_sequence).
            break;
          }

          // Append assistant turn (with tool_use) and tool_result(s) for next iter.
          convo.push({ role: "assistant", content: finalMessage.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            if (READ_TOOLS.has(tu.name)) {
              const result = await executeReadTool(
                tu.name,
                session.distribuidor_id,
                tu.input,
              );
              // Emit to frontend so UI can render rich card inline.
              send({ type: "tool_result", name: tu.name, data: result });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(result).slice(0, 8000),
              });
            } else {
              // WRITE tool — emit to frontend, NO server execution.
              send({ type: "tool_use", name: tu.name, input: tu.input });
              // Confirm to model that the action was dispatched.
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({
                  dispatched: true,
                  note: "El frontend ejecutará esta acción. Confirma al usuario brevemente.",
                }),
              });
            }
          }

          convo.push({ role: "user", content: toolResults });
        }

        send({ type: "done" });
      } catch (err) {
        console.error("[copilot] stream error", err);
        send({
          type: "error",
          message:
            err instanceof Error ? err.message.slice(0, 200) : "stream error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
