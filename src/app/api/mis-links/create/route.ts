/**
 * POST /api/mis-links/create
 *
 * Proxy autenticado: crea un nuevo public-link para el tenant.
 * Llama a POST ${BOT_API_URL}/api/v1/public-link/create
 * firmando con X-Auth v1.
 *
 * Body (JSON):
 *   max_uses         — número entero ≥ 1 (default 1)
 *   expires_in_days  — días de vigencia (default 7)
 *   cliente_email    — email del cliente (opcional)
 *   palancas_default — objeto de palancas (opcional)
 *
 * Response:
 *   { slug, public_url, expires_at }
 *
 * Plan gating: el backend devuelve 403 si el plan es starter.
 */

import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

const BOT_API_URL = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/mis-links/create] sign error", e);
    return errJson(
      "Estamos realizando tareas de mantenimiento. Intenta en unos minutos.",
      500
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errJson("El cuerpo de la solicitud no es JSON válido.", 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/public-link/create`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("[api/mis-links/create] backend fetch error", e);
    return errJson("No pudimos crear el link. Reintenta en unos segundos.", 502);
  }

  if (upstream.status === 403) {
    return errJson(
      "Esta función está disponible en los planes Pro, Empresa o Vendedor Telcel.",
      403
    );
  }
  if (upstream.status === 401) {
    return errJson("No tienes acceso a este recurso.", 401);
  }
  if (upstream.status === 429) {
    return errJson("Demasiadas solicitudes. Espera unos minutos.", 429);
  }
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    console.error("[api/mis-links/create] upstream error", upstream.status, text);
    return errJson("Error al crear el link. Reintenta.", 502);
  }

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return errJson("Respuesta inesperada del servidor.", 502);
  }
}
