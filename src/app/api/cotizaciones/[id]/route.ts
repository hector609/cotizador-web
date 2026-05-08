import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";
import type { Cotizacion, CrearCotizacionResponse, EstadoCotizacion } from "@/types/cotizacion";

/**
 * /api/cotizaciones/[id] — proxy autenticado al backend del bot.
 *
 * GET /api/cotizaciones/{id}
 *   → devuelve `{ cotizacion: { id, estado, pdf_url?, error?, ... } }`.
 *
 * Usado por el polling del wizard /dashboard/cotizar: tras el POST inicial
 * (que regresa 202 + cotizacion.id), el frontend pollea cada 5s hasta que
 * estado === "completada" | "fallida".
 *
 * SECURITY:
 *  - Mismo esquema de firma X-Auth que /api/cotizaciones (ver
 *    `src/lib/backend-auth.ts`).
 *  - El `id` del path se whitelistéa con regex UUID-ish para prevenir SSRF
 *    via path traversal hacia otros endpoints upstream.
 *  - El backend re-verifica que el `id` pertenezca al tenant derivado del
 *    HMAC; si no, 404. NUNCA confiar solo en este proxy para autorizar.
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

// El bot genera job_ids con uuid.uuid4().hex → 32 hex chars sin guiones.
// Whitelist estricto contra SSRF/path traversal y enumeración con caracteres
// que un humano podría usar para fuzzing (..,;,etc.). Backend re-valida.
const ID_REGEX = /^[a-f0-9]{32}$/i;

// Estados válidos. Los usamos como guard al sanitizar la respuesta upstream.
const VALID_ESTADOS: ReadonlySet<EstadoCotizacion> = new Set([
  "pendiente",
  "completada",
  "fallida",
]);

// Sanitizador: el bot puede agregar campos en el futuro o devolver datos
// extra accidentalmente (paths, telemetría, etc.). En lugar de reenviar
// `data` tal cual, reconstruimos un DTO con SOLO los campos del contrato
// público. El cast `as Type` de TS no filtra en runtime.
function sanitizeCotizacion(raw: unknown): Cotizacion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const estado = typeof r.estado === "string" ? (r.estado as EstadoCotizacion) : ("pendiente" as EstadoCotizacion);
  if (!id || !VALID_ESTADOS.has(estado)) return null;

  // pdf_url: validar scheme HTTPS para prevenir XSS via javascript:/data: URIs
  // si el bot devuelve un valor controlado por un atacante.
  let pdfUrl: string | undefined;
  if (typeof r.pdf_url === "string" && r.pdf_url) {
    try {
      const u = new URL(r.pdf_url);
      if (u.protocol === "https:") pdfUrl = r.pdf_url;
    } catch {
      // URL malformada, descartar.
    }
  }

  const lineas = typeof r.lineas === "number" && Number.isFinite(r.lineas) ? r.lineas : 0;
  const plan = typeof r.plan === "number" && Number.isFinite(r.plan) ? r.plan : 0;
  const equiposQty = typeof r.equipos_qty === "number" && Number.isFinite(r.equipos_qty) ? r.equipos_qty : 0;

  const cotizacion: Cotizacion = {
    id,
    estado,
    lineas,
    plan,
    equipos_qty: equiposQty,
    created_at: typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
  };
  if (typeof r.rfc === "string" && r.rfc) cotizacion.rfc = r.rfc;
  if (typeof r.equipo === "string" && r.equipo) cotizacion.equipo = r.equipo;
  if (pdfUrl) cotizacion.pdf_url = pdfUrl;
  if (typeof r.error === "string" && r.error) cotizacion.error = r.error.slice(0, 500);
  return cotizacion;
}

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
    console.error("[api/cotizaciones/[id] GET] sign error", e);
    return errJson("Servicio no disponible", 500);
  }

  const upstreamUrl = `${BOT_API_URL}/api/v1/cotizaciones/${encodeURIComponent(id)}`;

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
    console.error("[api/cotizaciones/[id] GET] backend fetch error", e);
    return errJson("Backend no disponible", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status === 404) {
    return errJson("Cotización no encontrada", 404);
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);
  if (!upstream.ok) return errJson("Error en backend", 502);

  let data: unknown;
  try {
    data = await upstream.json();
  } catch (e) {
    console.error("[api/cotizaciones/[id] GET] json parse", e);
    return errJson("Respuesta inválida del backend", 502);
  }

  // El bot devuelve `{ cotizacion: {...} }`. Sanitizamos antes de reenviar
  // al cliente para no leakear campos accidentales que el bot agregue.
  const wrapper = data as { cotizacion?: unknown };
  const sanitized = sanitizeCotizacion(wrapper?.cotizacion);
  if (!sanitized) {
    console.error("[api/cotizaciones/[id] GET] respuesta backend con shape inválida");
    return errJson("Respuesta inválida del backend", 502);
  }
  const out: CrearCotizacionResponse = { cotizacion: sanitized };
  return NextResponse.json(out, { status: 200 });
}
