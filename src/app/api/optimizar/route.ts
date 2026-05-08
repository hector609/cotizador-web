import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * POST /api/optimizar
 *
 * Proxy autenticado al backend del bot para sugerir palancas óptimas que
 * lleven a un AB target sin romper la regla AB 25%. Reenvía el body a
 * `${BOT_API_URL}/api/v1/optimizar` (HMAC X-Auth) y devuelve la propuesta
 * generada por Claude (Opus/Sonnet con tool-use iterativo).
 *
 * Body JSON:
 *   {
 *     rfc?: string,
 *     lineas: number,
 *     plan: string,
 *     plazo: 12|18|24|36,
 *     grupo?: "Empresa"|"Corporativo",
 *     modalidad?: "CPP"|"AA"|"MPP",
 *     equipo: { marca?: string, modelo: string } | string,
 *     equipos_qty?: number,
 *     ab_target: number (5..50, default 25),
 *     preferencias?: string
 *   }
 *
 * Respuesta 200:
 *   {
 *     palancas: { aportacion_voluntaria, meses_gratis, descuento_renta_pct,
 *                 beneficio_megas_pct, tasa_negociada_pct },
 *     rentabilidad_simulada: number,
 *     ab_logrado: number,
 *     alcanza_target: boolean,
 *     viola_ab25: boolean,
 *     razonamiento: string,
 *     baseline_sintetico: { renta_per_linea, precio_equipo, num_lineas, plazo_meses }
 *   }
 *
 * SECURITY:
 *  - Mismo HMAC X-Auth que los demás proxies.
 *  - El backend hace el rate-limiting natural (timeout 30s al call Claude).
 *  - 503 → fallback graceful (la UI mostrará "optimizador no disponible").
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";
// El optimizador puede tardar 5-15s (Claude tool-use loop). Damos 35s al
// timeout del fetch para que el backend (30s) responda primero con 504 si
// se cuelga, en lugar de cortar nosotros antes y dejar la cotización al aire.
const FETCH_TIMEOUT_MS = 35_000;

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

interface OptimizarRequestBody {
  rfc?: unknown;
  lineas?: unknown;
  plan?: unknown;
  plazo?: unknown;
  grupo?: unknown;
  modalidad?: unknown;
  equipo?: unknown;
  equipos_qty?: unknown;
  ab_target?: unknown;
  preferencias?: unknown;
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("No autenticado", 401);

  let body: OptimizarRequestBody;
  try {
    body = (await request.json()) as OptimizarRequestBody;
  } catch {
    return errJson("JSON inválido", 400);
  }

  // Validación ligera client-side antes de gastar el RTT al backend.
  // El backend hace la validación autoritativa.
  const lineasNum = Number(body.lineas);
  if (!Number.isInteger(lineasNum) || lineasNum < 1 || lineasNum > 500) {
    return errJson("lineas debe ser entero (1-500)", 400);
  }
  const plazoNum = Number(body.plazo);
  if (![12, 18, 24, 36].includes(plazoNum)) {
    return errJson("plazo debe ser 12, 18, 24 o 36", 400);
  }
  const abNum = body.ab_target == null ? 25 : Number(body.ab_target);
  if (!Number.isFinite(abNum) || abNum < 5 || abNum > 50) {
    return errJson("ab_target fuera de rango (5-50)", 400);
  }
  if (!body.equipo) return errJson("equipo requerido", 400);
  if (!body.plan) return errJson("plan requerido", 400);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/optimizar] sign error", e);
    return errJson("Servicio no disponible", 500);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/optimizar`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        rfc: typeof body.rfc === "string" ? body.rfc : undefined,
        lineas: lineasNum,
        plan: body.plan,
        plazo: plazoNum,
        grupo: typeof body.grupo === "string" ? body.grupo : undefined,
        modalidad: typeof body.modalidad === "string" ? body.modalidad : undefined,
        equipo: body.equipo,
        equipos_qty:
          body.equipos_qty == null ? undefined : Number(body.equipos_qty),
        ab_target: abNum,
        preferencias:
          typeof body.preferencias === "string" ? body.preferencias : undefined,
      }),
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return errJson("Timeout — el optimizador tardó demasiado", 504);
    }
    console.error("[api/optimizar] backend fetch error", e);
    return errJson("Backend no disponible", 502);
  } finally {
    clearTimeout(timer);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status === 503) {
    // Claude no disponible upstream — fallback graceful para la UI.
    return NextResponse.json(
      {
        unavailable: true,
        error: "Optimizador no disponible. Intenta en un momento.",
      },
      { status: 200 },
    );
  }
  if (upstream.status === 504) {
    return errJson("El optimizador tardó demasiado en responder", 504);
  }
  if (upstream.status === 400 || upstream.status === 422) {
    let msg = "No pudimos optimizar con esos parámetros";
    try {
      const data = (await upstream.json()) as { error?: unknown; hint?: unknown };
      if (typeof data?.error === "string" && data.error.length < 200) {
        msg =
          typeof data.hint === "string"
            ? `${data.error} — ${data.hint}`
            : data.error;
      }
    } catch {
      // ignore
    }
    return errJson(msg, 400);
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);
  if (!upstream.ok) return errJson("Error en backend", 502);

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("[api/optimizar] json parse", e);
    return errJson("Respuesta inválida del backend", 502);
  }
}
