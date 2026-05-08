/**
 * Server-side helper para listar cotizaciones desde el backend del bot.
 *
 * Diseñado para usarse en Server Components (p. ej. /dashboard/historial).
 * Replica el esquema HMAC del Route Handler /api/cotizaciones para que
 * podamos llamar directo al upstream sin un round-trip extra al loopback.
 *
 * Si el contrato de auth cambia (ver docs/CONTRACT.md cuando exista),
 * actualizar AMBOS sitios — este archivo y src/app/api/cotizaciones/route.ts —
 * en el mismo commit.
 *
 * SECURITY: el `tenant_id` se firma con TELEGRAM_BOT_TOKEN; el backend debe
 * derivar el tenant del header X-Auth y NUNCA aceptarlo del query string.
 */

import crypto from "crypto";
import type { ListarCotizacionesResponse } from "@/types/cotizacion";

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

function signTenant(tenantId: string, botToken: string): string {
  return crypto.createHmac("sha256", botToken).update(tenantId).digest("hex");
}

export async function listarCotizaciones(
  tenantId: string,
  params: ListarCotizacionesParams = {}
): Promise<ListarCotizacionesResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { ok: false, status: 500, message: "Configuración del servidor incompleta" };
  }

  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 20));
  qs.set("offset", String(params.offset ?? 0));
  if (params.estado) qs.set("estado", params.estado);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/cotizaciones?${qs.toString()}`, {
      method: "GET",
      headers: {
        "X-Auth": signTenant(tenantId, botToken),
        "X-Tenant-Id": tenantId,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, message: "Backend no disponible" };
  }

  // El backend del bot puede no haber implementado el endpoint todavía:
  // tratar 404 como "vacío" para que la UI muestre el empty state en lugar
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
  } catch {
    return { ok: false, status: 502, message: "Respuesta inválida del backend" };
  }
}

/** Enmascara un RFC mostrando solo los primeros 4 caracteres + asteriscos. */
export function maskRfc(rfc: string | undefined): string {
  if (!rfc) return "Sin base";
  const head = rfc.slice(0, 4);
  return `${head}${"*".repeat(Math.max(0, rfc.length - 4))}`;
}
