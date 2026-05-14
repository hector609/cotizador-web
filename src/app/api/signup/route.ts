import { NextResponse } from "next/server";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * POST /api/signup — proxy público al bot para solicitudes self-service.
 *
 * Sin sesión (es público). Validamos campos server-side (defense-in-depth) y
 * proxeamos a `${BOT_API_URL}/api/v1/signup` firmando con X-Auth v1 usando
 * distribuidor_id=0 — el bot ignora la auth en este endpoint pero el header
 * mantiene el esquema unificado por si en el futuro queremos restringir
 * ese endpoint a llamadas autenticadas.
 *
 * Mismo conjunto de validaciones que `/signup/page.tsx` y que el bot
 * (signup_requests.validate_signup_payload). Triple validación es overkill,
 * pero el costo es marginal y nos protege de proxies/CDNs maliciosos.
 *
 * Rate-limit: pendiente. Como mitigación trivial, max-bytes 4KB en el bot.
 * Si vemos abuso, agregar rate-limit por IP en la edge.
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const TG_USERNAME_REGEX = /^@?[A-Za-z0-9_]{3,32}$/;

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

interface SignupBody {
  email?: unknown;
  rfc_empresa?: unknown;
  nombre_distribuidor?: unknown;
  telefono?: unknown;
  telegram_username?: unknown;
}

function validate(body: SignupBody):
  | { ok: true; payload: Record<string, string> }
  | { ok: false; error: string } {
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) return { ok: false, error: "email inválido" };

  const rfc = String(body.rfc_empresa || "").trim().toUpperCase();
  if (!RFC_REGEX.test(rfc)) return { ok: false, error: "rfc_empresa inválido" };

  const nombre = String(body.nombre_distribuidor || "").trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return { ok: false, error: "nombre_distribuidor debe tener 2-80 chars" };
  }

  const telefono = String(body.telefono || "").trim();
  if (!PHONE_REGEX.test(telefono)) {
    return { ok: false, error: "telefono debe tener 10 dígitos" };
  }

  let tgRaw = String(body.telegram_username || "").trim();
  if (tgRaw && !TG_USERNAME_REGEX.test(tgRaw)) {
    return { ok: false, error: "telegram_username inválido" };
  }
  if (tgRaw.startsWith("@")) tgRaw = tgRaw.slice(1);

  return {
    ok: true,
    payload: {
      email,
      rfc_empresa: rfc,
      nombre_distribuidor: nombre,
      telefono,
      telegram_username: tgRaw,
    },
  };
}

export async function POST(request: Request) {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return errJson("Datos inválidos. Verifica los campos e intenta de nuevo.", 400);
  }

  const result = validate(body);
  if (!result.ok) return errJson(result.error, 400);

  // Firmar X-Auth con distribuidor_id=0 — el endpoint del bot no requiere auth
  // para signup, pero seguimos el esquema unificado. Si SESSION_SECRET no está
  // (build sin env), seguimos sin header — el bot acepta de todas formas.
  let authHeader: { "X-Auth": string } | Record<string, never> = {};
  try {
    authHeader = signBackendRequest(0);
  } catch (e) {
    console.warn("[api/signup] sign opcional falló, continúo sin X-Auth:", e);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeader,
      },
      body: JSON.stringify(result.payload),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/signup] backend fetch error", e);
    return errJson("Servicio no disponible. Intenta más tarde.", 502);
  }

  if (upstream.status >= 500) {
    return errJson("Servicio no disponible. Intenta más tarde.", 502);
  }
  if (!upstream.ok) {
    try {
      const data = (await upstream.json()) as { error?: string };
      return errJson(data.error || "No se pudo enviar", upstream.status);
    } catch {
      return errJson("No se pudo enviar", upstream.status);
    }
  }

  // No exponemos request_id ni detalles — solo OK genérico para no dar señal
  // a bots de qué requests son válidos.
  return NextResponse.json({ ok: true }, { status: 200 });
}
