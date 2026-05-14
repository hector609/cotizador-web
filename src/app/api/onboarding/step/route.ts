import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * /api/onboarding/step — proxy POST al backend.
 * Body: { step: number, data: object }
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  let body: { step?: unknown; data?: unknown };
  try {
    body = (await request.json()) as { step?: unknown; data?: unknown };
  } catch {
    return errJson("Datos inválidos.", 400);
  }

  const step = Number(body.step);
  if (!Number.isInteger(step) || step < 1 || step > 7) {
    return errJson("step debe ser entero entre 1 y 7", 400);
  }
  if (body.data !== undefined && (typeof body.data !== "object" || Array.isArray(body.data))) {
    return errJson("data debe ser un objeto", 400);
  }

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/onboarding/step POST] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/onboarding/step`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ step, data: body.data ?? {} }),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/onboarding/step POST] backend fetch error", e);
    return errJson("No pudimos guardar el paso. Reintenta.", 502);
  }

  if (upstream.status === 400) {
    let msg = "Los datos no son válidos.";
    try {
      const d = (await upstream.json()) as { error?: string };
      if (typeof d.error === "string" && d.error.length < 200) msg = d.error;
    } catch { /* ignore */ }
    return errJson(msg, 400);
  }
  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No tienes acceso a este recurso.", 403);
  }
  if (upstream.status >= 500) {
    return errJson("No pudimos guardar el paso. Reintenta.", 502);
  }
  if (!upstream.ok) {
    return errJson("Algo salió mal. Reintenta o contacta a soporte.", 502);
  }

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("[api/onboarding/step POST] json parse", e);
    return errJson("Respuesta inesperada del servidor. Reintenta.", 502);
  }
}
