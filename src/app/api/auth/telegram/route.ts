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
 * Si el hash es válido y el auth_date no es viejo (>1 hora), emite cookie
 * de sesión y redirige a /dashboard.
 *
 * NOTA: el bot token NUNCA se expone al cliente. Está solo en el server.
 */

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
  // TODO: aquí llamamos al backend Fly.io para validar que este user_id está
  // autorizado en algún tenant, y obtenemos su rol. Por ahora aceptamos cualquiera.
  const sessionPayload = {
    telegram_id: user.id,
    name: [user.first_name, user.last_name].filter(Boolean).join(" "),
    username: user.username || null,
    iat: Math.floor(Date.now() / 1000),
  };

  // Cookie firmada simple (HMAC). En siguiente iteración: JWT con expiración.
  const sessionStr = JSON.stringify(sessionPayload);
  const sessionB64 = Buffer.from(sessionStr).toString("base64url");
  const sessionSig = crypto
    .createHmac("sha256", botToken)
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
