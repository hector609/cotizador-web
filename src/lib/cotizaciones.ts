/**
 * Helpers para cotizaciones.
 *
 * Dos lados:
 *  1. Server-side (`listarCotizaciones`) — Server Components que llaman
 *     directo al upstream (`${BOT_API_URL}/api/v1/cotizaciones`) sin
 *     round-trip extra al loopback. Firma con `signBackendRequest`.
 *  2. Client-side (`crearCotizacionClient`) — wrapper alrededor de
 *     `fetch("/api/cotizaciones", ...)` que añade automáticamente un
 *     `Idempotency-Key: crypto.randomUUID()` para que el server pueda
 *     deduplicar doble-clicks (F9 del PENTEST-REPORT).
 *
 * SECURITY: el `distribuidor_id` se firma con SESSION_SECRET (esquema
 * unificado v1.<ts>.<hmac>); el backend deriva el tenant del header
 * X-Auth firmado y NUNCA del query string.
 */

import type {
  CrearCotizacionInput,
  CrearCotizacionResponse,
  ListarCotizacionesResponse,
} from "@/types/cotizacion";
import { signBackendRequest } from "@/lib/backend-auth";

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

export interface ListarCotizacionesParams {
  limit?: number;
  offset?: number;
  estado?: string;
  from?: string;
  to?: string;
}

export type ListarCotizacionesResult =
  | { ok: true; data: ListarCotizacionesResponse }
  | { ok: false; status: number; message: string };

/**
 * Lista cotizaciones desde un Server Component. Acepta `tenantId` como
 * `string | number` para compat con `session.tenant_id` (string derivado)
 * y con `session.distribuidor_id` (number firmado).
 */
export async function listarCotizaciones(
  tenantId: string | number,
  params: ListarCotizacionesParams = {}
): Promise<ListarCotizacionesResult> {
  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(tenantId);
  } catch (e) {
    console.error("[listarCotizaciones] sign error", e);
    return {
      ok: false,
      status: 500,
      message: "Configuración del servidor incompleta",
    };
  }

  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 20));
  qs.set("offset", String(params.offset ?? 0));
  if (params.estado) qs.set("estado", params.estado);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${BOT_API_URL}/api/v1/cotizaciones?${qs.toString()}`,
      {
        method: "GET",
        headers: {
          ...authHeader,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
  } catch (e) {
    console.error("[listarCotizaciones] backend fetch error", e);
    return { ok: false, status: 502, message: "Backend no disponible" };
  }

  // El backend del bot puede no haber implementado el endpoint todavía:
  // tratar 404 como "vacío" para que la UI muestre empty state en lugar
  // de un error confuso al DAT.
  if (upstream.status === 404) {
    return {
      ok: true,
      data: {
        cotizaciones: [],
        total: 0,
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
      },
    };
  }
  if (upstream.status === 401 || upstream.status === 403) {
    return { ok: false, status: 403, message: "No autorizado" };
  }
  if (upstream.status >= 500) {
    return { ok: false, status: 502, message: "Backend no disponible" };
  }
  if (!upstream.ok) {
    return { ok: false, status: 502, message: "Error en backend" };
  }
  try {
    const data = (await upstream.json()) as ListarCotizacionesResponse;
    return { ok: true, data };
  } catch (e) {
    console.error("[listarCotizaciones] json parse", e);
    return { ok: false, status: 502, message: "Respuesta inválida del backend" };
  }
}

/** Enmascara un RFC mostrando solo los primeros 4 caracteres + asteriscos. */
export function maskRfc(rfc: string | undefined): string {
  if (!rfc) return "Sin base";
  const head = rfc.slice(0, 4);
  return `${head}${"*".repeat(Math.max(0, rfc.length - 4))}`;
}

export type CrearCotizacionClientResult =
  | { ok: true; status: number; data: CrearCotizacionResponse }
  | { ok: false; status: number; message: string };

/**
 * Wrapper client-side de POST /api/cotizaciones. Añade automáticamente
 * `Idempotency-Key: crypto.randomUUID()` para que el server-side dedupe
 * doble-clicks (ver F9 del PENTEST-REPORT).
 *
 * Uso desde Client Components:
 *   const result = await crearCotizacionClient(payload);
 *   if (!result.ok) showError(result.message);
 *
 * NO incluye `credentials: "include"`: la cookie de sesión es same-origin
 * httpOnly y se manda automáticamente.
 */
export async function crearCotizacionClient(
  payload: CrearCotizacionInput,
  opts: { idempotencyKey?: string; signal?: AbortSignal } = {}
): Promise<CrearCotizacionClientResult> {
  // crypto.randomUUID está disponible en navegadores modernos (todos los
  // que soportamos para el dashboard) y en Node 19+. Fallback defensivo.
  const idempotencyKey =
    opts.idempotencyKey ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  let res: Response;
  try {
    res = await fetch("/api/cotizaciones", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message:
        e instanceof DOMException && e.name === "AbortError"
          ? "Operación cancelada"
          : "No pudimos contactar al servidor. Revisa tu conexión.",
    };
  }

  if (res.ok) {
    try {
      const data = (await res.json()) as CrearCotizacionResponse;
      return { ok: true, status: res.status, data };
    } catch {
      return {
        ok: false,
        status: res.status,
        message: "Respuesta inválida del servidor",
      };
    }
  }

  let message = "No pudimos crear la cotización. Inténtalo otra vez.";
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error.length < 200) {
      message = data.error;
    }
  } catch {
    // ignore
  }
  return { ok: false, status: res.status, message };
}
