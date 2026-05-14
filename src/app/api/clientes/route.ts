import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * GET /api/clientes
 *
 * Proxy autenticado al backend del bot. Lee la cookie `session` (firmada
 * con HMAC-SHA256 sobre SESSION_SECRET por /api/auth/telegram), valida la
 * firma con timingSafeEqual, extrae `distribuidor_id` y consulta clientes
 * en `${BOT_API_URL}/api/v1/clientes` firmando el header
 *   X-Auth: v1.<ts>.<hmac(SESSION_SECRET, "v1|<distribuidor_id>|<ts>")>
 * (esquema unificado con cotizador-telcel-bot/src/api/server.py).
 *
 * NO incluimos `tenant_id`/`telegram_id` en query string — el backend
 * deriva el tenant del payload firmado del X-Auth.
 *
 * SECURITY: el bot token y SESSION_SECRET NUNCA se exponen al cliente.
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("No autenticado", 401);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/clientes] sign error", e);
    return errJson("Servicio no disponible", 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/clientes`, {
      method: "GET",
      headers: {
        ...authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/clientes] backend fetch error", e);
    return errJson("Backend no disponible", 502);
  }

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
    // Normalise client shape: the scraper may produce `razon_social` instead
    // of `nombre` depending on the tenant's scrape path (huvasi vs celumaster).
    // Always expose `nombre` so the frontend never crashes on undefined.
    if (Array.isArray(data.clientes)) {
      data.clientes = data.clientes.map(
        (c: Record<string, unknown>) => ({
          ...c,
          nombre: (c.nombre as string) || (c.razon_social as string) || (c.rfc as string) || "—",
        })
      );
    }
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("[api/clientes] backend json parse", e);
    return errJson("Respuesta inválida del backend", 502);
  }
}
