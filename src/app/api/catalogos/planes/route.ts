import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * GET /api/catalogos/planes
 *
 * Proxy autenticado al backend del bot. Reenvía whitelist de query params
 * (`grupo`, `modalidad`, `plazo`) al endpoint upstream
 * `${BOT_API_URL}/api/v1/catalogos/planes`. Mismo esquema HMAC X-Auth que
 * el resto de los proxies.
 *
 * Si el backend devuelve 404, regresamos `{ planes: [], unavailable: true }`
 * con 200 para que la UI muestre fallback (lista corta + warning).
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/catalogos/planes] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  const url = new URL(request.url);
  const allowed = ["grupo", "modalidad", "plazo"] as const;
  const upstreamParams = new URLSearchParams();
  for (const key of allowed) {
    const v = url.searchParams.get(key);
    if (v) upstreamParams.set(key, v);
  }

  const qs = upstreamParams.toString();
  const upstreamUrl = `${BOT_API_URL}/api/v1/catalogos/planes${qs ? `?${qs}` : ""}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        ...authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/catalogos/planes] backend fetch error", e);
    return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  }

  if (upstream.status === 404) {
    return NextResponse.json(
      { planes: [], total: 0, unavailable: true },
      { status: 200 },
    );
  }
  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No tienes acceso a este recurso.", 403);
  }
  if (upstream.status >= 500) return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  if (!upstream.ok) return errJson("Algo salió mal. Reintenta o contacta a soporte.", 502);

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("[api/catalogos/planes] json parse", e);
    return errJson("Respuesta inesperada del servidor. Reintenta.", 502);
  }
}
