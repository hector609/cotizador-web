import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * POST /api/auth/telegram
 * Body: { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
 *
 * Recibe el callback del Telegram Login Widget. Valida el hash HMAC-SHA256
 * con el bot token (env TELEGRAM_BOT_TOKEN) según
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * Si el hash es válido y el auth_date no es viejo (>1 hora), emite una
 * cookie de sesión firmada con SESSION_SECRET (NO con el bot token) y
 * redirige a /dashboard.
 *
 * SEGURIDAD:
 *  - TELEGRAM_BOT_TOKEN se usa SOLO para verificar el widget de Telegram.
 *  - SESSION_SECRET se usa SOLO para firmar/verificar la cookie de sesión.
 *    Si se mezclaran, comprometer uno expondría al otro. Generar con:
 *      openssl rand -hex 32
 *  - Ningún secreto se expone al cliente.
 */

// Cold-start fail-fast: si no hay SESSION_SECRET, no podemos firmar sesiones
// de forma segura. NO usar el bot token como fallback.
function requireSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error(
      "SESSION_SECRET no configurado. Genéralo con `openssl rand -hex 32` y agrégalo a las variables de entorno."
    );
  }
  return s;
}
const SESSION_SECRET: string = requireSessionSecret();

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN no configurado en el server" },
      { status: 500 }
    );
  }

  let user: TelegramUser;
  try {
    user = (await request.json()) as TelegramUser;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!user.id || !user.auth_date || !user.hash) {
    return NextResponse.json(
      { error: "Faltan campos requeridos del widget Telegram" },
      { status: 400 }
    );
  }

  // Anti-replay: rechazar si el auth_date tiene más de 1 hora.
  const ageSeconds = Math.floor(Date.now() / 1000) - user.auth_date;
  if (ageSeconds > 3600 || ageSeconds < -300) {
    return NextResponse.json(
      { error: "Auth data expirada. Vuelve a intentar." },
      { status: 401 }
    );
  }

  // Validar hash HMAC: ordenar campos alfabéticamente, joinear con \n, hash con SHA256(botToken).
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
    return NextResponse.json(
      { error: "Hash inválido — auth no válida" },
      { status: 401 }
    );
  }

  // Hash válido. Emitir cookie de sesión.
  // TODO: backend debe devolver tenant_id real al validar el login. Por ahora
  // usamos el telegram_id como tenant_id provisional para que el resto del
  // sistema ya razone en términos de tenant. NO confiar en este valor en
  // backend: cuando se conecte el endpoint real de validación, sustituirlo.
  const sessionPayload = {
    telegram_id: user.id,
    tenant_id: String(user.id),
    name: [user.first_name, user.last_name].filter(Boolean).join(" "),
    username: user.username || null,
    iat: Math.floor(Date.now() / 1000),
  };

  // Cookie firmada con SESSION_SECRET (NO con el bot token). En siguiente
  // iteración: JWT con expiración explícita.
  const sessionStr = JSON.stringify(sessionPayload);
  const sessionB64 = Buffer.from(sessionStr).toString("base64url");
  const sessionSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(sessionB64)
    .digest("hex");

  const res = NextResponse.json({ ok: true, redirect: "/dashboard" });
  res.cookies.set("session", `${sessionB64}.${sessionSig}`, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 12, // 12h
    path: "/",
  });
  return res;
}
