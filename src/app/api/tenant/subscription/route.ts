/**
 * GET /api/tenant/subscription
 *
 * Proxy autenticado al bot para obtener la info de suscripción del tenant.
 * Usado por /dashboard/billing para mostrar plan, status, fecha de renovación.
 *
 * Auth: cookie session. Firma X-Auth para el bot.
 */

import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

const BOT_API_URL = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/tenant/subscription] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  try {
    const resp = await fetch(`${BOT_API_URL}/api/v1/tenant/subscription`, {
      headers: { ...authHeader },
      signal: AbortSignal.timeout(8_000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[api/tenant/subscription] bot error", resp.status, text);
      return errJson("Error al obtener suscripción", resp.status);
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/tenant/subscription] fetch error", e);
    return errJson("Error de conexión con el servidor", 502);
  }
}
