/**
 * Auth helpers para Server Components y Route Handlers.
 *
 * Lee la cookie `session` (firmada con HMAC-SHA256 sobre SESSION_SECRET por
 * /api/auth/telegram), verifica con timingSafeEqual y devuelve el payload.
 *
 * Convención cross-archivo: la lógica equivalente vive in-line en
 * /api/clientes/route.ts. Mantener ambas implementaciones idénticas hasta que
 * se centralice todo aquí (después del fix-pricing-exposure merge).
 */

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function requireSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error(
      "SESSION_SECRET no configurado. Genéralo con `openssl rand -hex 32` y agrégalo a las variables de entorno."
    );
  }
  return s;
}

export interface SessionPayload {
  telegram_id: number;
  tenant_id: string;
  name?: string;
  username?: string | null;
  iat: number;
}

/**
 * Verifica el cookie y devuelve el payload, o `null` si la firma no
 * coincide / el cookie está malformado. Usar timingSafeEqual para evitar
 * timing attacks en la comparación de la firma.
 */
export function verifySessionCookie(cookieValue: string): SessionPayload | null {
  const SESSION_SECRET = requireSessionSecret();
  const [b64, sig] = cookieValue.split(".");
  if (!b64 || !sig) return null;

  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(b64)
    .digest("hex");
  if (expected.length !== sig.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(b64, "base64url").toString("utf8")
    ) as SessionPayload;
    if (typeof parsed.tenant_id !== "string" || !parsed.tenant_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Lee la cookie en un Server Component (cookies() es async en Next 15+).
 * Si la sesión es inválida, redirige a /login (lanza, no retorna).
 */
export async function getSession(): Promise<SessionPayload> {
  const store = await cookies();
  const raw = store.get("session")?.value;
  if (!raw) redirect("/login");
  const session = verifySessionCookie(raw);
  if (!session) redirect("/login");
  return session;
}

/**
 * Variante sin redirect, útil para Route Handlers donde se quiere
 * responder con 401 JSON en vez de redirigir.
 */
export async function getSessionOrNull(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get("session")?.value;
  if (!raw) return null;
  return verifySessionCookie(raw);
}

/**
 * Variante para Route Handlers que reciben Request directo (donde no
 * podemos usar cookies() de next/headers en algunos contextos).
 */
export function getSessionFromRequest(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  if (!match) return null;
  return verifySessionCookie(decodeURIComponent(match[1]));
}
