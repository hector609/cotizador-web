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
 * Firma una request al backend del bot. Devuelve el header listo para mergear
 * en `headers`. NO incluye `X-Tenant-Id` — el backend deriva el tenant del
 * payload firmado, no de un header del cliente.
 */
export function signBackendRequest(distribuidorId: number | string): {
  "X-Auth": string;
} {
  const secret = getSessionSecret();
  const ts = Math.floor(Date.now() / 1000);
  // Esquema EXACTO que valida `verify_x_auth` en server.py:
  //   message = "v1|<tenant_id>|<ts>"
  // Mantener este string literal en sync con bot. Cambios deben ir en commit
  // coordinado en ambos repos.
  const message = `v1|${distribuidorId}|${ts}`;
  const mac = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");
  return { "X-Auth": `v1.${ts}.${mac}` };
}
