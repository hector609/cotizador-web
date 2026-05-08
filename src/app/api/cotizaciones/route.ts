import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionFromRequest } from "@/lib/auth";
import type {
  CrearCotizacionInput,
  ListarCotizacionesResponse,
  CrearCotizacionResponse,
} from "@/types/cotizacion";
import { RFC_REGEX } from "@/types/cotizacion";

/**
 * /api/cotizaciones — proxy autenticado al backend del bot.
 *
 * GET  /api/cotizaciones?limit=20&offset=0&estado=...&from=...&to=...
 *      → lista cotizaciones del tenant.
 * POST /api/cotizaciones
 *      Body: CrearCotizacionInput
 *      → crea cotización (job asíncrono Playwright en backend).
 *
 * SECURITY: backend MUST verify tenant_id from X-Auth and filter results by it.
 * Do NOT trust client IDs.
 *
 * Header X-Auth: HMAC-SHA256(TELEGRAM_BOT_TOKEN, tenant_id) — mismo esquema
 * que /api/clientes/route.ts. Si en el futuro docs/CONTRACT.md migra a
 * `HMAC(SESSION_SECRET, "${tenant_id}|${timestamp}")`, hay que actualizar
 * AMBOS handlers (clientes y cotizaciones) en el mismo commit para evitar
 * desync.
 *
 * El bot token y SESSION_SECRET NUNCA se exponen al cliente.
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

function signTenant(tenantId: string, botToken: string): string {
  return crypto.createHmac("sha256", botToken).update(tenantId).digest("hex");
}

function buildAuthHeaders(tenantId: string, botToken: string): HeadersInit {
  return {
    "X-Auth": signTenant(tenantId, botToken),
    "X-Tenant-Id": tenantId,
    Accept: "application/json",
  };
}

export async function GET(request: Request) {
  // SECURITY: backend MUST verify tenant_id from X-Auth and filter results by it.
  // Do NOT trust client IDs.
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return errJson("Configuración del servidor incompleta", 500);

  const session = getSessionFromRequest(request);
  if (!session) return errJson("No autenticado", 401);

  // Parse pasa-thru de query params (whitelist explícito; nunca aceptar
  // tenant_id vía query — el backend lo deriva del X-Auth firmado).
  const url = new URL(request.url);
  const allowed = ["limit", "offset", "estado", "from", "to"] as const;
  const upstreamParams = new URLSearchParams();
  for (const key of allowed) {
    const v = url.searchParams.get(key);
    if (v) upstreamParams.set(key, v);
  }
  if (!upstreamParams.has("limit")) upstreamParams.set("limit", "20");
  if (!upstreamParams.has("offset")) upstreamParams.set("offset", "0");

  const upstreamUrl = `${BOT_API_URL}/api/v1/cotizaciones?${upstreamParams.toString()}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: buildAuthHeaders(session.tenant_id, botToken),
      cache: "no-store",
    });
  } catch {
    return errJson("Backend no disponible", 502);
  }

  if (upstream.status === 404) {
    const empty: ListarCotizacionesResponse = {
      cotizaciones: [],
      total: 0,
      limit: Number(upstreamParams.get("limit")) || 20,
      offset: Number(upstreamParams.get("offset")) || 0,
    };
    return NextResponse.json(empty, { status: 200 });
  }
  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);
  if (!upstream.ok) return errJson("Error en backend", 502);

  try {
    const data = (await upstream.json()) as ListarCotizacionesResponse;
    return NextResponse.json(data, { status: 200 });
  } catch {
    return errJson("Respuesta inválida del backend", 502);
  }
}

export async function POST(request: Request) {
  // SECURITY: backend MUST verify tenant_id from X-Auth and filter results by it.
  // Do NOT trust client IDs.
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return errJson("Configuración del servidor incompleta", 500);

  const session = getSessionFromRequest(request);
  if (!session) return errJson("No autenticado", 401);

  let body: CrearCotizacionInput;
  try {
    body = (await request.json()) as CrearCotizacionInput;
  } catch {
    return errJson("JSON inválido", 400);
  }

  // Validación server-side defensiva (la UI ya valida, pero NO se puede
  // confiar en el cliente: cualquiera puede llamar este endpoint con curl).
  if (body.rfc !== undefined && body.rfc !== "") {
    if (typeof body.rfc !== "string" || !RFC_REGEX.test(body.rfc)) {
      return errJson("RFC inválido", 400);
    }
  }
  if (
    typeof body.lineas !== "number" ||
    !Number.isInteger(body.lineas) ||
    body.lineas < 1 ||
    body.lineas > 500
  ) {
    return errJson("Líneas debe ser entero entre 1 y 500", 400);
  }
  if (
    typeof body.plan !== "number" ||
    body.plan < 100 ||
    body.plan > 5000
  ) {
    return errJson("Plan debe estar entre 100 y 5000 MXN", 400);
  }
  if (
    typeof body.equipos_qty !== "number" ||
    !Number.isInteger(body.equipos_qty) ||
    body.equipos_qty < 0 ||
    body.equipos_qty > body.lineas
  ) {
    return errJson("Cantidad de equipos inválida", 400);
  }

  // Whitelist el payload que se envía upstream (no pasar campos extra).
  const upstreamBody = {
    rfc: body.rfc || undefined,
    lineas: body.lineas,
    plan: body.plan,
    equipo: body.equipo || undefined,
    equipos_qty: body.equipos_qty,
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/cotizaciones`, {
      method: "POST",
      headers: {
        ...buildAuthHeaders(session.tenant_id, botToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
    });
  } catch {
    return errJson("Backend no disponible", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status === 400 || upstream.status === 422) {
    // Pasar mensaje del backend si está disponible y es seguro (no stacktrace).
    try {
      const data = await upstream.json();
      const msg =
        typeof data?.error === "string" ? data.error : "Datos inválidos";
      return errJson(msg, 400);
    } catch {
      return errJson("Datos inválidos", 400);
    }
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);
  if (!upstream.ok) return errJson("Error en backend", 502);

  try {
    const data = (await upstream.json()) as CrearCotizacionResponse;
    return NextResponse.json(data, { status: 201 });
  } catch {
    return errJson("Respuesta inválida del backend", 502);
  }
}
