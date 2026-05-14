import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * GET /api/catalogos/equipos
 *
 * Proxy autenticado al backend del bot. Reenvía query params `marca` y `q`
 * (whitelist) al endpoint upstream `${BOT_API_URL}/api/v1/catalogos/equipos`,
 * firmando con el mismo esquema X-Auth que /api/clientes y /api/cotizaciones.
 *
 * Si el backend aún no implementa el endpoint (404), devolvemos lista vacía
 * con 200 para que la UI haga fallback graceful (catálogo hardcoded corto +
 * warning) sin romper.
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
    console.error("[api/catalogos/equipos] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  // Whitelist: solo `marca` y `q` se pasan al upstream.
  const url = new URL(request.url);
  const allowed = ["marca", "q"] as const;
  const upstreamParams = new URLSearchParams();
  for (const key of allowed) {
    const v = url.searchParams.get(key);
    if (v) upstreamParams.set(key, v);
  }

  const qs = upstreamParams.toString();
  const upstreamUrl = `${BOT_API_URL}/api/v1/catalogos/equipos${qs ? `?${qs}` : ""}`;

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
    console.error("[api/catalogos/equipos] backend fetch error", e);
    return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  }

  if (upstream.status === 404) {
    // Backend aún no expone catálogo. La UI hace fallback graceful.
    return NextResponse.json(
      { equipos: [], total: 0, unavailable: true },
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
    console.error("[api/catalogos/equipos] json parse", e);
    return errJson("Respuesta inesperada del servidor. Reintenta.", 502);
  }
}
