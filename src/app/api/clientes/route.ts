import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * GET /api/clientes
 *
 * Proxy autenticado al backend Fly.io. Lee la cookie `session` (firmada con
 * HMAC-SHA256 sobre TELEGRAM_BOT_TOKEN en /api/auth/telegram), valida la
 * firma con timingSafeEqual, extrae `telegram_id` y consulta clientes en
 * cmdemobot.fly.dev firmando el header X-Auth con el mismo bot token.
 *
 * El bot token NUNCA se expone al cliente.
 */

const BACKEND_URL = "https://cmdemobot.fly.dev/api/v1/clientes";

interface SessionPayload {
  telegram_id: number;
  iat: number;
}

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

function verifySession(cookieValue: string, botToken: string): SessionPayload | null {
  const [b64, sig] = cookieValue.split(".");
  if (!b64 || !sig) return null;

  const expected = crypto.createHmac("sha256", botToken).update(b64).digest("hex");
  if (expected.length !== sig.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(b64, "base64url").toString("utf8")
    ) as SessionPayload;
    return typeof parsed.telegram_id === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return errJson("Configuración del servidor incompleta", 500);

  // 1. Leer y validar cookie session
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  if (!match) return errJson("No autenticado", 401);

  const session = verifySession(decodeURIComponent(match[1]), botToken);
  if (!session) return errJson("No autenticado", 401);

  // 2. Firmar telegram_id con HMAC-SHA256 para X-Auth
  const telegramId = String(session.telegram_id);
  const xAuth = crypto.createHmac("sha256", botToken).update(telegramId).digest("hex");

  // 3. Llamar al backend
  let upstream: Response;
  try {
    upstream = await fetch(
      `${BACKEND_URL}?telegram_id=${encodeURIComponent(telegramId)}`,
      {
        method: "GET",
        headers: { "X-Auth": xAuth, Accept: "application/json" },
        cache: "no-store",
      }
    );
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
