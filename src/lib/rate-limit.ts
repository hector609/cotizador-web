/**
 * src/lib/rate-limit.ts
 *
 * Helper para rate limiting persistente a través de Vercel KV (Upstash Redis).
 * Reemplaza los `Map` in-memory que sólo viven en una instancia del lambda y
 * se resetean en cada cold start.
 *
 * Estrategia: contador atómico con TTL.
 *   1. `INCR key` — devuelve el counter actualizado (1 en el primer hit).
 *   2. Si `count === 1` → `EXPIRE key windowSec` (set TTL solo en el primer hit
 *      de la ventana, así no extendemos el window con cada llamada).
 *   3. Si `count > limit` → `allowed = false`.
 *
 * Fallback graceful: si `KV_REST_API_URL` no está en env (típicamente dev
 * local sin KV configurado, o un deploy temprano antes de provisionar el
 * store), NO bloqueamos — `allowed: true` siempre. Esto evita romper dev/
 * preview cuando el KV no está listo.
 *
 * TODO(monitoring): cuando KV esté operativo en producción, agregar log
 * estructurado `[rate-limit] key=... count=N limit=L action=BLOCKED` para
 * que sea trivial alertar en Logflare/Datadog si alguien intenta abusar.
 */

import { kv } from "@vercel/kv";

export interface RateLimitResult {
  /** `true` si la request puede proceder. `false` si excedió el límite. */
  allowed: boolean;
  /** Cuántas requests restan en la ventana actual (mínimo 0). */
  remaining: number;
  /** Segundos hasta que la ventana se resetee. Sólo válido si `!allowed`. */
  retryAfter?: number;
}

/**
 * Verifica + incrementa el contador para `key`. Cada llamada cuenta como 1.
 *
 * @param key       Identificador único (e.g. `aria:concierge:ip:1.2.3.4`).
 *                  Convención: namespace:endpoint:scope:id para evitar colisiones.
 * @param limit     Máximo de hits permitidos por ventana.
 * @param windowSec TTL de la ventana en segundos.
 * @returns         `{ allowed, remaining, retryAfter? }`.
 *
 * Si KV no está configurado (`KV_REST_API_URL` ausente) → siempre `allowed: true`.
 * Si KV falla por red/error transitorio → log + `allowed: true` (fail-open). El
 * razonamiento es que rompiendo silenciosamente un endpoint es peor que dejar
 * pasar tráfico extra durante un blip.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  // Fallback dev: sin KV configurado, no bloqueamos nada.
  if (!process.env.KV_REST_API_URL) {
    return { allowed: true, remaining: limit };
  }

  try {
    const count = await kv.incr(key);
    // Sólo seteamos TTL en el primer hit; así la ventana es fija desde
    // el primer request del usuario y no se "renueva" con cada llamada.
    if (count === 1) {
      await kv.expire(key, windowSec);
    }
    const remaining = Math.max(0, limit - count);
    if (count > limit) {
      // Pedirle el TTL real al store nos da un `retry_after` preciso para el
      // header Retry-After. Si TTL = -1 (sin expiración, no debería pasar)
      // caemos a `windowSec` como upper bound.
      let retryAfter = windowSec;
      try {
        const ttl = await kv.ttl(key);
        if (typeof ttl === "number" && ttl > 0) retryAfter = ttl;
      } catch {
        // ignore: usamos windowSec como fallback
      }
      return { allowed: false, remaining: 0, retryAfter };
    }
    return { allowed: true, remaining };
  } catch (err) {
    console.error("[rate-limit] KV error, fail-open:", err);
    return { allowed: true, remaining: limit };
  }
}
