import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionSecret } from "@/lib/backend-auth";

/**
 * GET /api/auth/admin-login?t=<base64url(payload)>.<hex_sig>
 *
 * Login directo sin widget Telegram — para super-admin / debugging /
 * onboarding cuando el flujo Telegram no es accesible (incognito sin
 * sesión Telegram, dominio aún no whitelisted en BotFather, etc.).
 *
 * Payload firmado HMAC-SHA256(SESSION_SECRET, b64) que contiene
 * { vendedor_id, distribuidor_id, role, exp }. La cookie de sesión se
 * emite con httpOnly + secure + samesite=lax (lax para que funcione tras
 * navegación cross-site al click del enlace).
 *
 * NUNCA expongas la URL públicamente — quien la tenga entra al dashboard
 * con el rol firmado. Útil para enviar a un admin por canal seguro.
 */

const SESSION_TTL_SEC = 60 * 60 * 24; // 24h

interface AdminLoginPayload {
  vendedor_id: number;
  distribuidor_id: number;
  role: string;
  exp: number;
}

function errPage(msg: string, status: number) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Login</title>` +
      `<style>body{font-family:system-ui;padding:40px;max-width:600px;margin:auto}h1{color:#dc2626}p{color:#475569}a{color:#2563eb}</style>` +
      `<h1>No se pudo iniciar sesión</h1><p>${msg}</p>` +
      `<p><a href="/login">Ir a login</a></p>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") || "";
  if (!token || token.indexOf(".") < 0) return errPage("Token inválido o ausente.", 400);

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return errPage("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 503);
  }

  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return errPage("Token mal formado.", 400);

  const expected = crypto.createHmac("sha256", secret).update(b64).digest("hex");
  if (expected.length !== sig.length) return errPage("Firma inválida.", 401);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
      return errPage("Firma inválida.", 401);
    }
  } catch {
    return errPage("Firma inválida.", 401);
  }

  let payload: AdminLoginPayload;
  try {
    payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as AdminLoginPayload;
  } catch {
    return errPage("Token corrupto.", 400);
  }

  if (
    typeof payload.vendedor_id !== "number" ||
    typeof payload.distribuidor_id !== "number" ||
    typeof payload.role !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return errPage("Token con formato inválido.", 400);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec >= payload.exp) {
    return errPage("Este enlace expiró. Pídele uno nuevo a tu administrador.", 401);
  }

  const sessionPayload = {
    vendedor_id: payload.vendedor_id,
    distribuidor_id: payload.distribuidor_id,
    role: payload.role,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SEC,
  };
  const sessB64 = Buffer.from(JSON.stringify(sessionPayload)).toString("base64url");
  const sessSig = crypto.createHmac("sha256", secret).update(sessB64).digest("hex");

  const res = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  res.cookies.set("session", `${sessB64}.${sessSig}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_SEC,
    path: "/",
  });
  return res;
}
