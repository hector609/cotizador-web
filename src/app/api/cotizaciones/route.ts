import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";
import { rewritePdfUrl } from "@/lib/cotizaciones";
import type {
  CrearCotizacionInput,
  ListarCotizacionesResponse,
  CrearCotizacionResponse,
  Cotizacion,
} from "@/types/cotizacion";
import { RFC_REGEX } from "@/types/cotizacion";

/**
 * /api/cotizaciones — proxy autenticado al backend del bot.
 *
 * GET  /api/cotizaciones?limit=20&offset=0&estado=...&from=...&to=...
 *      → lista cotizaciones del tenant.
 * POST /api/cotizaciones
 *      Body: CrearCotizacionInput
 *      Headers (opcional): Idempotency-Key
 *      → crea cotización (job asíncrono Playwright en backend).
 *
 * SECURITY:
 *  - Header X-Auth: `v1.<ts>.<hmac(SESSION_SECRET, "v1|<distribuidor_id>|<ts>")>`
 *    (unificado con `cotizador-telcel-bot/src/api/server.py`). Helper en
 *    `src/lib/backend-auth.ts`.
 *  - NO se incluye `tenant_id`/`telegram_id` en query string. El backend
 *    deriva el tenant del payload firmado.
 *  - Idempotency-Key: dedup en memoria por
 *    `${distribuidor_id}:${idempotency_key}` con TTL 5min para prevenir
 *    F9 (doble-click race). TODO: mover a Vercel KV / Redis cuando salgamos
 *    de single-region.
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 min

interface IdempotencyEntry {
  status: number;
  body: unknown;
  expiresAt: number;
}

// Map en memoria. En Vercel single-region funciona porque las invocaciones
// del mismo handler tienden a colocar en la misma instancia caliente; no
// es garantía 100% pero cubre el caso de doble-click humano. Para
// garantía completa cross-instancia → migrar a Vercel KV / Upstash.
// TODO(KV): mover a storage compartido si pasamos a multi-region.
const idempotencyCache = new Map<string, IdempotencyEntry>();

function pruneIdempotency(now: number): void {
  // Barrer perezosamente entradas vencidas. Map iteration order es de
  // inserción, así que el primero en vencer suele estar al frente.
  for (const [key, entry] of idempotencyCache) {
    if (entry.expiresAt > now) break;
    idempotencyCache.delete(key);
  }
}

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/cotizaciones GET] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  // Whitelist de query params al upstream (NUNCA pasar tenant_id).
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
      headers: {
        ...authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/cotizaciones GET] backend fetch error", e);
    return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
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
    return errJson("No tienes acceso a este recurso.", 403);
  }
  if (upstream.status >= 500) return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  if (!upstream.ok) return errJson("Algo salió mal. Reintenta o contacta a soporte.", 502);

  try {
    const data = (await upstream.json()) as ListarCotizacionesResponse;
    // Reescribe pdf_url / pdf_url_interno al proxy frontend
    const rewritten = {
      ...data,
      cotizaciones: data.cotizaciones.map((c): Cotizacion => {
        const pdfUrl = rewritePdfUrl(c.pdf_url, c.id, "cliente");
        const pdfUrlInterno = rewritePdfUrl(c.pdf_url_interno, c.id, "interno");
        return {
          ...c,
          pdf_url: pdfUrl,
          pdf_url_interno: pdfUrlInterno,
        };
      }),
    };
    return NextResponse.json(rewritten, { status: 200 });
  } catch (e) {
    console.error("[api/cotizaciones GET] json parse", e);
    return errJson("Respuesta inesperada del servidor. Reintenta.", 502);
  }
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  // F9: dedup por Idempotency-Key + distribuidor_id. Si el frontend manda
  // el mismo key dos veces (doble-click) devolvemos la respuesta cacheada
  // sin re-ejecutar el job upstream.
  const idempotencyKeyRaw = request.headers.get("Idempotency-Key");
  const idempotencyKey =
    typeof idempotencyKeyRaw === "string" &&
    /^[A-Za-z0-9._\-]{8,128}$/.test(idempotencyKeyRaw)
      ? idempotencyKeyRaw
      : null;

  const cacheKey = idempotencyKey
    ? `${session.distribuidor_id}:${idempotencyKey}`
    : null;

  if (cacheKey) {
    const now = Date.now();
    pruneIdempotency(now);
    const cached = idempotencyCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  let body: CrearCotizacionInput;
  try {
    body = (await request.json()) as CrearCotizacionInput;
  } catch {
    return errJson("Datos inválidos. Verifica los campos e intenta de nuevo.", 400);
  }

  // Validación server-side defensiva (la UI ya valida, pero NO se puede
  // confiar en el cliente: cualquiera puede llamar este endpoint con curl).
  if (body.rfc !== undefined && body.rfc !== "") {
    if (typeof body.rfc !== "string" || !RFC_REGEX.test(body.rfc)) {
      return errJson("RFC inválido", 400);
    }
  }

  // Detectar shape: si viene `perfiles` array no vacío, es multi-perfil; si
  // no, validamos los cuatro campos legacy (lineas/plan/equipo/equipos_qty).
  const isMulti = Array.isArray(body.perfiles) && body.perfiles.length > 0;

  let upstreamBody: Record<string, unknown>;

  if (isMulti) {
    const perfiles = body.perfiles!;
    if (perfiles.length < 1 || perfiles.length > 10) {
      return errJson("perfiles[] debe tener entre 1 y 10 elementos", 400);
    }
    let totalLineas = 0;
    for (let i = 0; i < perfiles.length; i++) {
      const p = perfiles[i];
      if (!p || typeof p !== "object") {
        return errJson(`perfiles[${i}] inválido`, 400);
      }
      if (typeof p.equipo !== "string" || !p.equipo.trim()) {
        return errJson(`perfiles[${i}].equipo requerido`, 400);
      }
      if (
        typeof p.lineas !== "number" ||
        !Number.isInteger(p.lineas) ||
        p.lineas < 1 ||
        p.lineas > 500
      ) {
        return errJson(
          `perfiles[${i}].lineas debe ser entero entre 1 y 500`,
          400,
        );
      }
      if (
        typeof p.equipos_qty !== "number" ||
        !Number.isInteger(p.equipos_qty) ||
        p.equipos_qty < 0 ||
        p.equipos_qty > p.lineas
      ) {
        return errJson(`perfiles[${i}].equipos_qty inválido`, 400);
      }
      totalLineas += p.lineas;
    }
    if (totalLineas > 1000) {
      return errJson(
        `Total de líneas combinadas (${totalLineas}) excede 1000`,
        400,
      );
    }
    if (
      body.plan_global !== undefined &&
      body.plan_global !== "" &&
      typeof body.plan_global !== "string"
    ) {
      return errJson("plan_global debe ser string", 400);
    }
    upstreamBody = {
      rfc: body.rfc || undefined,
      perfiles: perfiles.map((p) => ({
        equipo: p.equipo,
        lineas: p.lineas,
        equipos_qty: p.equipos_qty,
      })),
      plan_global: body.plan_global || undefined,
    };
  } else {
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

    // Whitelist el payload upstream (no pasar campos extra).
    upstreamBody = {
      rfc: body.rfc || undefined,
      lineas: body.lineas,
      plan: body.plan,
      equipo: body.equipo || undefined,
      equipos_qty: body.equipos_qty,
    };
  }

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/cotizaciones POST] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/cotizaciones`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/cotizaciones POST] backend fetch error", e);
    return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No tienes acceso a este recurso.", 403);
  }
  if (upstream.status === 400 || upstream.status === 422) {
    // Pasar mensaje del backend SOLO si es string seguro (no stacktrace).
    let msg = "Los datos no son válidos. Verifica los campos.";
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
  if (upstream.status >= 500) return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  if (!upstream.ok) return errJson("Algo salió mal. Reintenta o contacta a soporte.", 502);

  let data: CrearCotizacionResponse;
  try {
    data = (await upstream.json()) as CrearCotizacionResponse;
  } catch (e) {
    console.error("[api/cotizaciones POST] json parse", e);
    return errJson("Respuesta inesperada del servidor. Reintenta.", 502);
  }

  // F9: cachear la respuesta exitosa para deduplicar reintentos del mismo key.
  if (cacheKey) {
    idempotencyCache.set(cacheKey, {
      status: 201,
      body: data,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    });
  }

  return NextResponse.json(data, { status: 201 });
}
