import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * GET /api/clientes
 *
 * Proxy autenticado al backend Fly.io. Lee la cookie `session` (firmada con
 * HMAC-SHA256 sobre SESSION_SECRET en /api/auth/telegram), valida la firma
 * con timingSafeEqual, extrae `tenant_id` y consulta clientes en
 * cmdemobot.fly.dev firmando el header X-Auth con TELEGRAM_BOT_TOKEN
 * (acuerdo simétrico entre web y backend).
 *
 * SECURITY: backend MUST verify tenant_id from X-Auth matches resource
 * ownership. Do NOT trust any client-supplied IDs.
 *
 * El bot token y SESSION_SECRET NUNCA se exponen al cliente.
 */

const BACKEND_URL = "https://cmdemobot.fly.dev/api/v1/clientes";

function requireSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error(
      "SESSION_SECRET no configurado. Genéralo con `openssl rand -hex 32` y agrégalo a las variables de entorno."
    );
  }
  return s;
}
const SESSION_SECRET: string = requireSessionSecret();

interface SessionPayload {
  telegram_id: number;
  tenant_id: string;
  iat: number;
}

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

function verifySession(cookieValue: string): SessionPayload | null {
  const [b64, sig] = cookieValue.split(".");
  if (!b64 || !sig) return null;

  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(b64)
    .digest("hex");
  if (expected.length !== sig.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(b64, "base64url").toString("utf8")
    ) as SessionPayload;
    if (typeof parsed.tenant_id !== "string" || !parsed.tenant_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  // SECURITY: backend MUST verify tenant_id from X-Auth matches resource
  // ownership. Do NOT trust any client-supplied IDs.
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return errJson("Configuración del servidor incompleta", 500);

  // 1. Leer y validar cookie session
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  if (!match) return errJson("No autenticado", 401);

  const session = verifySession(decodeURIComponent(match[1]));
  if (!session) return errJson("No autenticado", 401);

  // 2. Firmar tenant_id con HMAC-SHA256(botToken) para X-Auth.
  //    El backend identifica al usuario SOLO por este header firmado, no por
  //    parámetros en la query string controlables por el cliente.
  const tenantId = session.tenant_id;
  const xAuth = crypto
    .createHmac("sha256", botToken)
    .update(tenantId)
    .digest("hex");

  // 3. Llamar al backend (sin telegram_id en la URL).
  let upstream: Response;
  try {
    upstream = await fetch(BACKEND_URL, {
      method: "GET",
      headers: {
        "X-Auth": xAuth,
        "X-Tenant-Id": tenantId,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return errJson("Backend no disponible", 502);
  }

  // 4. Mapear status del backend
  if (upstream.status === 404) {
    return NextResponse.json({ clientes: [], total: 0 }, { status: 200 });
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);
  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (!upstream.ok) return errJson("Error en backend", 502);

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return errJson("Respuesta inválida del backend", 502);
  }
}
