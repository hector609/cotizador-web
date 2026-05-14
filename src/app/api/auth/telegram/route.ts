import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * POST /api/auth/telegram
 * Body: { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
 *
 * Recibe el callback del Telegram Login Widget. Flujo:
 *
 *   1. Valida el hash HMAC-SHA256 del widget con TELEGRAM_BOT_TOKEN
 *      (https://core.telegram.org/widgets/login#checking-authorization).
 *   2. Anti-replay: rechaza si auth_date tiene más de 1h.
 *   3. **Llama a `${BOT_API_URL}/api/v1/auth/verify`** con el payload del
 *      widget. El backend devuelve `{vendedor_id, distribuidor_id, role,
 *      nombre}` SOLO si el `telegram_id` está en la whitelist de vendedores.
 *      Si rechaza → 403; si está caído → 503. NUNCA emitimos cookie con
 *      datos parciales o derivados del telegram_id solo (eso era F1 del
 *      pentest: cualquier Telegram entraba al dashboard).
 *   4. Emite cookie de sesión firmada con SESSION_SECRET con payload
 *      `{vendedor_id, distribuidor_id, role, exp, iat}`. La cookie solo
 *      contiene IDs reales del backend; el `telegram_id` no se persiste
 *      en sesión.
 *
 * SEGURIDAD:
 *  - TELEGRAM_BOT_TOKEN se usa SOLO para verificar el widget.
 *  - SESSION_SECRET se usa SOLO para firmar/verificar la cookie.
 *  - Si se mezclaran, comprometer uno expondría el otro.
 *    Generar con `openssl rand -hex 32`.
 *  - Ningún secreto se expone al cliente.
 *
 * TODO: refresh-token / renovación de sesión sin re-login Telegram.
 */

import { getSessionSecret } from "@/lib/backend-auth";

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface VerifyResponse {
  vendedor_id: number;
  distribuidor_id: number;
  role: string;
  nombre?: string;
}

const SESSION_TTL_SEC = 60 * 60 * 24; // 24h

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    // Server config — log internamente, no leakear el detalle.
    console.error("[auth/telegram] TELEGRAM_BOT_TOKEN no configurado");
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  const botApiUrl = process.env.BOT_API_URL;
  if (!botApiUrl) {
    console.error("[auth/telegram] BOT_API_URL no configurado");
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  let user: TelegramUser;
  try {
    user = (await request.json()) as TelegramUser;
  } catch {
    return errJson("Datos inválidos. Verifica los campos e intenta de nuevo.", 400);
  }

  if (!user.id || !user.auth_date || !user.hash) {
    return errJson("Faltan campos requeridos del widget Telegram", 400);
  }

  // Anti-replay: rechazar si auth_date tiene más de 1 hora (o futuro >5min).
  const ageSeconds = Math.floor(Date.now() / 1000) - user.auth_date;
  if (ageSeconds > 3600 || ageSeconds < -300) {
    return errJson("Auth data expirada. Vuelve a intentar.", 401);
  }

  // 1) Validar hash del widget con BOT_TOKEN.
  const { hash, ...rest } = user;
  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (
    computedHash.length !== hash.length ||
    !crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash))
  ) {
    return errJson("Hash inválido — auth no válida", 401);
  }

  // 2) Hash válido. Validar contra la whitelist del bot vía /api/v1/auth/verify.
  //    Si el backend no autoriza al telegram_id → 403, no emitir cookie.
  //    Si el backend no responde → 503, no emitir cookie con datos parciales.
  let verifyRes: Response;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    try {
      verifyRes = await fetch(`${botApiUrl}/api/v1/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(user),
        cache: "no-store",
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.error("[auth/telegram] backend verify timeout/network", e);
    return errJson("Servicio temporalmente no disponible", 503);
  }

  if (verifyRes.status === 401 || verifyRes.status === 403) {
    return errJson(
      "Tu usuario no tiene acceso autorizado. Solicita acceso a tu administrador.",
      403
    );
  }
  if (!verifyRes.ok) {
    // 5xx u otros — backend no respondió OK, no emitir cookie.
    console.error(
      "[auth/telegram] backend verify status",
      verifyRes.status
    );
    return errJson("Servicio temporalmente no disponible", 503);
  }

  let verified: VerifyResponse;
  try {
    verified = (await verifyRes.json()) as VerifyResponse;
  } catch (e) {
    console.error("[auth/telegram] backend verify json parse", e);
    return errJson("Servicio temporalmente no disponible", 503);
  }

  if (
    typeof verified.vendedor_id !== "number" ||
    typeof verified.distribuidor_id !== "number" ||
    typeof verified.role !== "string"
  ) {
    console.error("[auth/telegram] backend verify shape inválido");
    return errJson("Servicio temporalmente no disponible", 503);
  }

  // 3) Emitir cookie firmada con SESSION_SECRET. Payload mínimo: solo IDs
  //    reales devueltos por el backend (NO telegram_id).
  let sessionSecret: string;
  try {
    sessionSecret = getSessionSecret();
  } catch (e) {
    console.error("[auth/telegram] SESSION_SECRET no configurado", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionPayload = {
    vendedor_id: verified.vendedor_id,
    distribuidor_id: verified.distribuidor_id,
    role: verified.role,
    iat: now,
    exp: now + SESSION_TTL_SEC,
  };

  const sessionStr = JSON.stringify(sessionPayload);
  const sessionB64 = Buffer.from(sessionStr).toString("base64url");
  const sessionSig = crypto
    .createHmac("sha256", sessionSecret)
    .update(sessionB64)
    .digest("hex");

  const res = NextResponse.json({ ok: true, redirect: "/dashboard" });
  res.cookies.set("session", `${sessionB64}.${sessionSig}`, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: SESSION_TTL_SEC,
    path: "/",
  });
  return res;
}
