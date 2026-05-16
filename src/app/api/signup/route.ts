import { NextResponse } from "next/server";
import { signBackendRequest } from "@/lib/backend-auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/signup — proxy público al bot para solicitudes self-service.
 *
 * Sin sesión (es público). Validamos campos server-side (defense-in-depth) y
 * proxeamos a `${BOT_API_URL}/api/v1/signup` firmando con X-Auth v1 usando
 * distribuidor_id=0 — el bot ignora la auth en este endpoint pero el header
 * mantiene el esquema unificado por si en el futuro queremos restringir
 * ese endpoint a llamadas autenticadas.
 *
 * tenant_type:
 *   - "individual"   → vendedor Telcel persona física (RFC PF 13 chars)
 *   - "distribuidor" → distribuidor empresa (RFC PM/PF 12-13 chars)
 *
 * Rate-limit: 5 req/min por IP. Vercel KV via `src/lib/rate-limit.ts`.
 * Si KV no está configurado (dev local), fail-open con log warning.
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

// Rate limit: 5 solicitudes de registro por minuto por IP.
const RL_WINDOW_SEC = 60;
const RL_MAX_HITS = 5;

function getIp(request: Request): string {
  const h = request.headers;
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

const RFC_EMPRESA_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const RFC_PF_REGEX = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/; // PF estricto: 4 letras = 13 chars
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const TG_USERNAME_REGEX = /^@?[A-Za-z0-9_]{3,32}$/;

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

interface SignupBody {
  tenant_type?: unknown;
  email?: unknown;
  rfc_empresa?: unknown;
  nombre_distribuidor?: unknown;
  telefono?: unknown;
  telegram_username?: unknown;
}

function validate(body: SignupBody):
  | { ok: true; payload: Record<string, string> }
  | { ok: false; error: string } {
  const tenantType = String(body.tenant_type || "distribuidor").trim();
  const isIndividual = tenantType === "individual";

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) return { ok: false, error: "email inválido" };

  const rfc = String(body.rfc_empresa || "").trim().toUpperCase();
  if (isIndividual) {
    if (!RFC_PF_REGEX.test(rfc))
      return { ok: false, error: "rfc_empresa inválido — se espera RFC persona física (13 chars)" };
  } else {
    if (!RFC_EMPRESA_REGEX.test(rfc))
      return { ok: false, error: "rfc_empresa inválido" };
  }

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
      tenant_type: isIndividual ? "individual" : "distribuidor",
      email,
      rfc_empresa: rfc,
      nombre_distribuidor: nombre,
      telefono,
      telegram_username: tgRaw,
    },
  };
}

export async function POST(request: Request) {
  // Rate limit por IP.
  const ip = getIp(request);
  const rl = await rateLimit(`signup:${ip}`, RL_MAX_HITS, RL_WINDOW_SEC);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? RL_WINDOW_SEC) } },
    );
  }

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
