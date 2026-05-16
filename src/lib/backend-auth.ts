/**
 * Helper para firmar requests al backend del bot (cmdemobot.fly.dev).
 *
 * Esquema HMAC alineado con `cotizador-telcel-bot/src/api/server.py`
 * (función `verify_x_auth`):
 *
 *     X-Auth: v1.<unix_ts>.<hmac_hex>
 *     hmac = HMAC-SHA256(SESSION_SECRET, "v1|<tenant_id>|<unix_ts>")
 *
 * El backend rechaza si:
 *  - El timestamp está fuera de ±5 min (window que mantiene server.py).
 *  - El HMAC no coincide en tiempo constante.
 *
 * Notas:
 *  - SESSION_SECRET (NO el bot token). Si se filtra uno, el otro queda intacto.
 *  - El `tenant_id`/`distribuidor_id` se firma DENTRO del payload — no se
 *    confía en query strings ni en headers `X-Tenant-Id`. Si en producción se
 *    persiste rotación de SESSION_SECRET, este módulo debe leer la versión
 *    activa (TODO: secret store).
 *  - SESSION_SECRET se lee lazy (NO en module-load) para no romper builds que
 *    no tengan la env aún cargada (Vercel preview, CI sin secret, etc.).
 */

import crypto from "crypto";
import zlib from "zlib";

/**
 * Lectura lazy del secreto. Lanza dentro del handler que lo usa, NO al
 * importar el módulo, para evitar crash global en build/cold-start si la
 * env tarda en propagarse (ver F7 del PENTEST-REPORT).
 */
export function getSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error(
      "SESSION_SECRET no configurado. Genéralo con `openssl rand -hex 32` y agrégalo a las variables de entorno."
    );
  }
  return s;
}

/**
 * Convierte un slug ("celumaster") a su `distribuidor_id` numérico
 * (`crc32(slug) & 0x7FFFFFFF`). Equivalente a `_distribuidor_id_numeric`
 * en `cotizador_bot.py`. Si el input ya es un número o un string
 * compuesto solo de dígitos, se devuelve tal cual (no re-deriva).
 */
function resolveNumericDistribuidorId(distribuidorIdOrSlug: number | string): number {
  if (typeof distribuidorIdOrSlug === "number") {
    return distribuidorIdOrSlug;
  }
  // String numérico → parsear directo (back-compat con cookies viejas que
  // emitían `tenant_id = String(distribuidor_id)`).
  if (/^\d+$/.test(distribuidorIdOrSlug)) {
    return parseInt(distribuidorIdOrSlug, 10);
  }
  // Slug → crc32. zlib.crc32 devuelve uint32; aplicamos & 0x7FFFFFFF para
  // matchear el cómputo de Python (`zlib.crc32(...) & 0x7FFFFFFF`).
  return zlib.crc32(Buffer.from(distribuidorIdOrSlug, "utf-8")) & 0x7fffffff;
}

/**
 * Firma una request al backend del bot. Devuelve el header listo para mergear
 * en `headers`. NO incluye `X-Tenant-Id` — el backend deriva el tenant del
 * payload firmado, no de un header del cliente.
 *
 * Acepta tanto el `distribuidor_id` numérico como el `tenant_slug` (string
 * no-numérico). Cuando llega slug, lo convertimos a numérico via crc32 —
 * equivalente al cómputo del backend (`_distribuidor_id_numeric`). Esto
 * permite que `session.tenant_id` venga como slug (cookies nuevas con
 * `tenant_slug` firmado) o como número stringificado (cookies viejas).
 */
export function signBackendRequest(distribuidorIdOrSlug: number | string): {
  "X-Auth": string;
} {
  const secret = getSessionSecret();
  const ts = Math.floor(Date.now() / 1000);
  const numericDid = resolveNumericDistribuidorId(distribuidorIdOrSlug);
  // Esquema EXACTO que valida `verify_x_auth` en server.py:
  //   message = "v1|<distribuidor_id_numeric>|<ts>"
  // Mantener este string literal en sync con bot. Cambios deben ir en commit
  // coordinado en ambos repos.
  const message = `v1|${numericDid}|${ts}`;
  const mac = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");
  return { "X-Auth": `v1.${ts}.${mac}` };
}
