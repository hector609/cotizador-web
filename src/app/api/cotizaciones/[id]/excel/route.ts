import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * GET /api/cotizaciones/[id]/excel — descarga resumen .xlsx de una cotización.
 *
 * El backend acepta como `id`:
 *  - `job_id` de web_jobs (uuid hex 32 chars).
 *  - `folio` del historial JSONL (alfanumérico Telcel).
 *
 * Whitelist regex defensiva contra path traversal / SSRF: solo aceptamos
 * alfanuméricos con `-` y `_`, max 64 chars. El backend re-valida y filtra
 * por tenant.
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

// Acepta uuid hex o folio alfanumérico de Telcel. El bot también valida.
const ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !ID_REGEX.test(id)) {
    return errJson("ID inválido", 400);
  }

  const session = getSessionFromRequest(request);
  if (!session) return errJson("No autenticado", 401);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/cotizaciones/[id]/excel GET] sign error", e);
    return errJson("Servicio no disponible", 500);
  }

  const upstreamUrl = `${BOT_API_URL}/api/v1/cotizaciones/${encodeURIComponent(
    id
  )}/excel`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        ...authHeader,
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/cotizaciones/[id]/excel GET] backend fetch error", e);
    return errJson("Backend no disponible", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status === 404) {
    return errJson("Cotización no encontrada", 404);
  }
  if (upstream.status === 400) {
    // El bot devuelve 400 si la cot está pendiente/fallida — passthrough mensaje.
    let msg = "Cotización aún no disponible";
    try {
      const data = await upstream.json();
      if (typeof data?.error === "string" && data.error.length < 200) {
        msg = data.error;
      }
    } catch {
      // ignore
    }
    return errJson(msg, 400);
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);
  if (!upstream.ok) return errJson("Error en backend", 502);

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ||
        `attachment; filename="cotizacion_${id}.xlsx"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
