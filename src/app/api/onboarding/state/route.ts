import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * /api/onboarding/state — proxy GET al backend.
 * Firma X-Auth con SESSION_SECRET usando distribuidor_id de la sesión.
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
    console.error("[api/onboarding/state GET] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/onboarding/state`, {
      method: "GET",
      headers: { ...authHeader, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/onboarding/state GET] backend fetch error", e);
    return errJson("No pudimos cargar el estado del wizard. Reintenta.", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No tienes acceso a este recurso.", 403);
  }
  if (upstream.status >= 500) {
    return errJson("No pudimos cargar el estado del wizard. Reintenta.", 502);
  }
  if (!upstream.ok) {
    return errJson("Algo salió mal. Reintenta o contacta a soporte.", 502);
  }

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("[api/onboarding/state GET] json parse", e);
    return errJson("Respuesta inesperada del servidor. Reintenta.", 502);
  }
}
