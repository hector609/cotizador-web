import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * /api/tenant/credentials — proxy autenticado al bot para creds Telcel del tenant.
 *
 * GET  /api/tenant/credentials
 *      → bot devuelve {usuario_enmascarado, tiene_password, actualizado}.
 * POST /api/tenant/credentials
 *      Body: {usuario, password}
 *      → bot cifra con TENANT_MASTER_KEY (Fernet) y persiste en tenant_config.
 *
 * Auth: lee la cookie `session` (HMAC verificada en getSessionFromRequest),
 * extrae `distribuidor_id` y firma X-Auth con SESSION_SECRET. El bot resuelve
 * el tenant a partir del HMAC — NO confiamos en headers `X-Tenant-Id`.
 *
 * SECURITY:
 *  - El password viaja en el body sobre HTTPS al bot. Nunca se loguea en este
 *    handler ni se persiste en cliente (la página borra el state tras éxito).
 *  - El GET nunca devuelve el password en claro — solo metadata.
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
    console.error("[api/tenant/credentials] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/tenant/credentials/meta`, {
      method: "GET",
      headers: {
        ...authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/tenant/credentials] backend GET error", e);
    return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
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
    console.error("[api/tenant/credentials] GET parse", e);
    return errJson("Respuesta inesperada del servidor. Reintenta.", 502);
  }
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  let body: { usuario?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { usuario?: unknown; password?: unknown };
  } catch {
    return errJson("Datos inválidos. Verifica los campos e intenta de nuevo.", 400);
  }

  const usuario = String(body.usuario || "").trim();
  const password = String(body.password || "");
  if (!usuario || !usuario.includes("@")) {
    return errJson("usuario debe ser un email válido", 400);
  }
  if (password.length < 4 || password.length > 256) {
    return errJson("password fuera de rango (4-256 chars)", 400);
  }

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/tenant/credentials] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/tenant/credentials`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ usuario, password }),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/tenant/credentials] backend POST error", e);
    return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No tienes acceso a este recurso.", 403);
  }
  if (upstream.status >= 500) return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  if (!upstream.ok) {
    try {
      const data = (await upstream.json()) as { error?: string };
      return errJson(data.error || "Algo salió mal. Reintenta o contacta a soporte.", upstream.status);
    } catch {
      return errJson("Algo salió mal. Reintenta o contacta a soporte.", upstream.status);
    }
  }

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
