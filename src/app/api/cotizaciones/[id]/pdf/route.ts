import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * GET /api/cotizaciones/[id]/pdf?formato=cliente|interno
 *
 * Proxy autenticado al endpoint del bot:
 *   GET {BOT_API_URL}/api/v1/cotizaciones/<id>/pdf?formato=...
 *
 * Streamea el binario tal cual preservando `Content-Type: application/pdf`
 * y `Content-Disposition`. NO carga el archivo a memoria — pass-through del
 * `ReadableStream` upstream.
 *
 * Cierra el loop con backend PR #55: el handler de status ahora devuelve
 * `pdf_url` como path relativo (`/api/v1/cotizaciones/<id>/pdf`); el proxy
 * `/api/cotizaciones/[id]` lo reescribe a path del frontend
 * (`/api/cotizaciones/<id>/pdf?formato=cliente`) que apunta a este handler.
 *
 * SECURITY:
 *  - Whitelist regex del `id` contra path traversal/SSRF.
 *  - `formato` whitelist a `cliente|interno` (default cliente).
 *  - Mismo X-Auth v1 que `/api/cotizaciones/[id]` y `/api/cotizaciones/[id]/excel`.
 *  - Backend re-valida ownership por tenant (403 cross-tenant).
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

// Acepta uuid hex o folio alfanumérico de Telcel. El bot también valida.
const ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const FORMATO_VALIDOS = new Set(["cliente", "interno"]);

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

  const url = new URL(request.url);
  const formatoRaw = url.searchParams.get("formato") || "cliente";
  const formato = FORMATO_VALIDOS.has(formatoRaw) ? formatoRaw : "cliente";

  const session = getSessionFromRequest(request);
  if (!session) return errJson("No autenticado", 401);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/cotizaciones/[id]/pdf GET] sign error", e);
    return errJson("Servicio no disponible", 500);
  }

  const upstreamUrl = `${BOT_API_URL}/api/v1/cotizaciones/${encodeURIComponent(
    id
  )}/pdf?formato=${encodeURIComponent(formato)}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        ...authHeader,
        Accept: "application/pdf",
      },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/cotizaciones/[id]/pdf GET] backend fetch error", e);
    return errJson("Backend no disponible", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status === 404) {
    // 404 puede ser: job inexistente, archivo no en disco, formato no
    // disponible. Passthrough mensaje del backend si vino como JSON.
    let msg = "PDF no encontrado";
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
    // Cotización pendiente o fallida — passthrough mensaje del backend.
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

  // Stream pass-through: NO `.arrayBuffer()` ni `.blob()` — el body se
  // reenvía como ReadableStream. Para archivos grandes esto evita inflar
  // memoria del Edge/Node runtime de Vercel.
  if (!upstream.body) {
    return errJson("Respuesta vacía del backend", 502);
  }

  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") || "application/pdf",
    "Content-Disposition":
      upstream.headers.get("content-disposition") ||
      `attachment; filename="cotizacion_${id}_${formato}.pdf"`,
    "Cache-Control": "no-store",
  };
  // Content-Length opcional — si upstream lo provee, lo propagamos para que
  // el browser pueda mostrar progreso.
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers["Content-Length"] = contentLength;

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
