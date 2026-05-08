/**
 * Auth helpers para Server Components y Route Handlers.
 *
 * Lee la cookie `session` (firmada con HMAC-SHA256 sobre SESSION_SECRET por
 * /api/auth/telegram), verifica con timingSafeEqual, valida `exp` y devuelve
 * el payload.
 *
 * Payload firmado (post-fix F1):
 *   { vendedor_id, distribuidor_id, role, iat, exp }
 *
 * Para mantener compat con consumers legacy (`session.tenant_id`), el objeto
 * que devuelven `getSession*` incluye `tenant_id = String(distribuidor_id)`
 * derivado, NO firmado. No leer `tenant_id` para autorizar nada cross-tenant
 * en backend — el backend deriva el tenant del HMAC del header X-Auth.
 *
 * SESSION_SECRET se lee lazy (NO en module-load) — ver `getSessionSecret` en
 * `backend-auth.ts`. Ver F7 del PENTEST-REPORT.
 */

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionSecret } from "@/lib/backend-auth";

/** Payload tal como se firma dentro de la cookie. */
export interface SignedSessionPayload {
  vendedor_id: number;
  distribuidor_id: number;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Vista expuesta a consumers. Incluye `tenant_id` derivado para compat con
 * el código que ya razona en términos de tenant (string). NO se firma.
 */
export interface SessionPayload extends SignedSessionPayload {
  tenant_id: string;
}

/**
 * Verifica el cookie y devuelve el payload, o `null` si la firma no
 * coincide / el cookie está malformado / `exp` venció. Comparación de
 * firma con timingSafeEqual para evitar timing attacks.
 */
export function verifySessionCookie(cookieValue: string): SessionPayload | null {
  let SESSION_SECRET: string;
  try {
    SESSION_SECRET = getSessionSecret();
  } catch {
    // Sin secret no podemos validar nada. Falla cerrada — no logueamos detalle
    // aquí porque este path se ejecuta por request; el origen del error ya se
    // loguea cuando getSessionSecret se invoca explícitamente desde un handler.
    return null;
  }

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

  let parsed: SignedSessionPayload;
  try {
    parsed = JSON.parse(
      Buffer.from(b64, "base64url").toString("utf8")
    ) as SignedSessionPayload;
  } catch {
    return null;
  }

  if (
    typeof parsed.distribuidor_id !== "number" ||
    typeof parsed.vendedor_id !== "number" ||
    typeof parsed.role !== "string" ||
    typeof parsed.iat !== "number" ||
    typeof parsed.exp !== "number"
  ) {
    return null;
  }

  // F3: rechazar si la cookie venció. `exp` viaja firmado.
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec >= parsed.exp) return null;

  return {
    ...parsed,
    tenant_id: String(parsed.distribuidor_id),
  };
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
