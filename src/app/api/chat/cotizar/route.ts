import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * POST /api/chat/cotizar — proxy autenticado al endpoint conversacional del bot.
 *
 * Upstream: `${BOT_API_URL}/api/v1/chat/cotizar`
 *
 * Contrato (alineado con bot v110):
 *   Request:  { conversation_id?: string, message: string }
 *   Response: { status: "ask"        | "validation_error", conversation_id, message } (200)
 *           | { status: "started", job_id, estado, message, rfc }                      (202)
 *           | { error: "rate_limited", retry_after }                                  (429)
 *           | { error: "agent_unavailable", detail }                                  (503)
 *           | { error: "..." }                                                         (400/401/403)
 *
 * SECURITY:
 *  - Validamos `message` length ≤ 2000 chars (mismo límite del backend).
 *  - `conversation_id` se reenvía solo si es string corto sin caracteres raros.
 *  - El backend reverifica que el `conversation_id` pertenezca al tenant
 *    derivado del HMAC — no confiamos en este proxy para aislar tenants.
 *  - HMAC X-Auth idéntico al resto de proxies (ver `signBackendRequest`).
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";
const MAX_MESSAGE_LEN = 2000;
const CONVERSATION_ID_RE = /^[A-Za-z0-9._\-]{1,128}$/;

const errJson = (msg: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error: msg, ...(extra || {}) }, { status });

interface ChatRequestBody {
  conversation_id?: unknown;
  message?: unknown;
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("No autenticado", 401);

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return errJson("JSON inválido", 400);
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return errJson("Campo `message` requerido", 400);
  if (message.length > MAX_MESSAGE_LEN) {
    return errJson(`Mensaje excede ${MAX_MESSAGE_LEN} caracteres`, 400);
  }

  const conversationId =
    typeof body.conversation_id === "string" &&
    CONVERSATION_ID_RE.test(body.conversation_id)
      ? body.conversation_id
      : undefined;

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/chat/cotizar] sign error", e);
    return errJson("Servicio no disponible", 500);
  }

  const upstreamBody: Record<string, unknown> = { message };
  if (conversationId) upstreamBody.conversation_id = conversationId;

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/chat/cotizar`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/chat/cotizar] backend fetch error", e);
    return errJson("Backend no disponible", 502);
  }

  // Parsear JSON una sola vez; muchos status codes traen body informativo.
  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    data = null;
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status === 429) {
    const retryAfter =
      data && typeof (data as Record<string, unknown>).retry_after === "number"
        ? (data as Record<string, unknown>).retry_after
        : 30;
    return errJson("rate_limited", 429, { retry_after: retryAfter });
  }
  if (upstream.status === 503) {
    return errJson("agent_unavailable", 503);
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);

  // 200 (ask | validation_error) y 202 (started) pasan tal cual.
  if (upstream.status === 200 || upstream.status === 202) {
    return NextResponse.json(data ?? {}, { status: upstream.status });
  }
  if (upstream.status === 400) {
    let msg = "Solicitud inválida";
    if (data && typeof (data as Record<string, unknown>).error === "string") {
      const e = (data as Record<string, unknown>).error as string;
      if (e.length < 200) msg = e;
    }
    return errJson(msg, 400);
  }
  return errJson("Error en backend", 502);
}
