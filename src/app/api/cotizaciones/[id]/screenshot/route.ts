import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * GET /api/cotizaciones/[id]/screenshot
 *
 * Proxy autenticado al endpoint del bot:
 *   GET {BOT_API_URL}/api/v1/cotizaciones/<id>/screenshot
 *
 * Streamea el PNG tal cual preservando `Content-Type: image/png`. NO carga
 * el archivo a memoria — pass-through del `ReadableStream` upstream.
 *
 * Caso de uso: cotizaciones BORRADOR (sin RFC) donde Telcel no genera PDF
 * oficial. El bot captura el resumen en pantalla como evidencia y lo deja
 * disponible vía este endpoint para que la web lo muestre en el chat (como
 * thumbnail) y en historial (como botón "Ver captura").
 *
 * SECURITY:
 *  - Whitelist regex del `id` contra path traversal/SSRF.
 *  - Mismo X-Auth v1 que `/api/cotizaciones/[id]` y `/api/cotizaciones/[id]/pdf`.
 *  - Backend re-valida ownership por tenant (403 cross-tenant).
 *  - Sirve `inline` (no `attachment`) para que pueda usarse en `<img src>`
 *    desde la UI; pero queda detrás de cookie de sesión httpOnly.
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
    console.error("[api/cotizaciones/[id]/screenshot GET] sign error", e);
    return errJson("Servicio no disponible", 500);
  }

  const upstreamUrl = `${BOT_API_URL}/api/v1/cotizaciones/${encodeURIComponent(
    id
  )}/screenshot`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        ...authHeader,
        Accept: "image/png",
      },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/cotizaciones/[id]/screenshot GET] backend fetch error", e);
    return errJson("Backend no disponible", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status === 404) {
    let msg = "Captura no encontrada";
    try {
      const data = await upstream.json();
      if (typeof data?.error === "string" && data.error.length < 200) {
        msg = data.error;
      }
    } catch {
      // ignore
    }
    return errJson(msg, 404);
  }
  if (upstream.status === 409) {
    let msg = "Cotización aún no disponible";
    try {
      const data = await upstream.json();
      if (typeof data?.error === "string" && data.error.length < 200) {
        msg = data.error;
      }
    } catch {
      // ignore
    }
    return errJson(msg, 409);
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);
  if (!upstream.ok) return errJson("Error en backend", 502);

  if (!upstream.body) {
    return errJson("Respuesta vacía del backend", 502);
  }

  // Inline (no attachment) — la UI muestra el PNG en un <img> dentro del
  // chat y en historial el botón abre la imagen en nueva pestaña. El user
  // puede usar "Guardar imagen como" del browser si quiere descargar.
  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") || "image/png",
    "Content-Disposition":
      upstream.headers.get("content-disposition") ||
      `inline; filename="cotizacion_${id}.png"`,
    "Cache-Control": "no-store",
  };
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers["Content-Length"] = contentLength;

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
