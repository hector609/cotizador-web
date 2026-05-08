import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionSecret } from "@/lib/backend-auth";

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Login email+password contra el backend del bot. El backend mantiene el
 * password store (bcrypt-hashed en data/web_passwords.json) y devuelve el
 * payload de sesión que aquí firmamos con SESSION_SECRET en cookie httpOnly.
 *
 * Responses:
 *  - 200 { ok:true } + cookie session — redirige el cliente a /dashboard.
 *  - 400 — JSON / campos inválidos.
 *  - 401 — Credenciales inválidas (genérico, no enumerable).
 *  - 403 — tenant_paused.
 *  - 429 — Rate limit (con Retry-After del backend).
 *  - 503 — Backend caído / SESSION_SECRET no configurado.
 *
 * El widget Telegram (POST /api/auth/telegram) sigue activo en paralelo.
 */

interface LoginPayload {
  vendedor_id: number;
  distribuidor_id: number;
  role: string;
  nombre?: string;
  tenant_slug?: string;
}

const SESSION_TTL_SEC = 60 * 60 * 24; // 24h, mismo que telegram

const errJson = (msg: string, status: number, headers?: Record<string, string>) =>
  NextResponse.json({ error: msg }, { status, headers });

export async function POST(request: Request) {
  // 1) Validar body.
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return errJson("JSON inválido", 400);
  }

  const email = (body.email || "").trim();
  const password = body.password || "";

  if (!email || !password) {
    return errJson("Email y contraseña son requeridos", 400);
  }
  if (!email.includes("@")) {
    return errJson("Email no parece válido", 400);
  }

  // 2) Llamar al backend del bot.
  const botApiUrl = process.env.BOT_API_URL;
  if (!botApiUrl) {
    console.error("[auth/login] BOT_API_URL no configurado");
    return errJson("Servicio no disponible", 503);
  }

  let upstream: Response;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10_000);
    try {
      upstream = await fetch(`${botApiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.error("[auth/login] backend timeout/network", e);
    return errJson("Servicio temporalmente no disponible", 503);
  }

  // 3) Mapear errores. Pasar 429 con Retry-After al cliente.
  if (upstream.status === 429) {
    const retryAfter = upstream.headers.get("Retry-After") || "300";
    return errJson(
      "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
      429,
      { "Retry-After": retryAfter }
    );
  }
  if (upstream.status === 401) {
    return errJson("Email o password incorrectos", 401);
  }
  if (upstream.status === 403) {
    // tenant_paused u otros 403. Mensaje específico para el usuario.
    let detail: { error?: string } = {};
    try {
      detail = (await upstream.json()) as { error?: string };
    } catch {
      // ignore
    }
    if (detail.error === "tenant_paused") {
      return errJson(
        "Tu distribuidor está pausado. Contacta a tu administrador.",
        403
      );
    }
    return errJson("Acceso denegado", 403);
  }
  if (!upstream.ok) {
    console.error("[auth/login] backend status", upstream.status);
    return errJson("Servicio temporalmente no disponible", 503);
  }

  // 4) Parsear payload — mismo shape que /api/v1/auth/verify.
  let payload: LoginPayload;
  try {
    payload = (await upstream.json()) as LoginPayload;
  } catch (e) {
    console.error("[auth/login] backend json parse", e);
    return errJson("Servicio temporalmente no disponible", 503);
  }
  if (
    typeof payload.vendedor_id !== "number" ||
    typeof payload.distribuidor_id !== "number" ||
    typeof payload.role !== "string"
  ) {
    console.error("[auth/login] backend payload shape inválido");
    return errJson("Servicio temporalmente no disponible", 503);
  }

  // 5) Emitir cookie de sesión firmada con SESSION_SECRET. Mismo formato y
  //    fields que /api/auth/telegram para que la verificación downstream sea
  //    idéntica (no necesita saber qué método de login se usó).
  let sessionSecret: string;
  try {
    sessionSecret = getSessionSecret();
  } catch (e) {
    console.error("[auth/login] SESSION_SECRET no configurado", e);
    return errJson("Servicio no disponible", 503);
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionPayload = {
    vendedor_id: payload.vendedor_id,
    distribuidor_id: payload.distribuidor_id,
    role: payload.role,
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
