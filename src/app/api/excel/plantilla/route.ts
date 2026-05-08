import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * GET /api/excel/plantilla — proxy autenticado al backend del bot.
 *
 * Devuelve la plantilla .xlsx que el vendedor llena para subir cotizaciones
 * multi-perfil desde la web. La plantilla es global (no depende del tenant)
 * pero requerimos sesión para no exponerla a anónimos.
 *
 * Flujo:
 *  1. Verifica cookie de sesión (getSessionFromRequest).
 *  2. Firma con X-Auth v1 contra el bot.
 *  3. Stream del binario .xlsx tal cual al cliente con headers Content-Type
 *     y Content-Disposition.
 *
 * SECURITY:
 *  - Si la sesión no es válida → 401 (no se llama al backend).
 *  - El backend re-verifica X-Auth.
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
    console.error("[api/excel/plantilla GET] sign error", e);
    return errJson("Servicio no disponible", 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/excel/plantilla`, {
      method: "GET",
      headers: {
        ...authHeader,
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/excel/plantilla GET] backend fetch error", e);
    return errJson("Backend no disponible", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);
  if (!upstream.ok) return errJson("Error en backend", 502);

  // Stream binario. Reusamos el body del upstream tal cual + content-disposition.
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ||
        'attachment; filename="plantilla_cotizacion.xlsx"',
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
