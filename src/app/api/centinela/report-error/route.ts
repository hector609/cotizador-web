/**
 * /api/centinela/report-error — proxy que forwardea errores web al backend.
 * Devuelve 204 always (no leak info).
 *
 * Rate-limit: 30 req/min por IP. Fail-open si KV no está disponible.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";

// Rate limit: 30 reportes por minuto por IP.
const RL_WINDOW_SEC = 60;
const RL_MAX_HITS = 30;

function getIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

interface ErrorPayload {
  source: "web";
  route: string;
  error_message: string;
  stack?: string;
  digest?: string;
}

function computeHMAC(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

export async function POST(req: NextRequest): Promise<Response> {
  // Rate limit por IP. El endpoint siempre responde 204 — incluyendo el 429
  // silencioso para no revelar al cliente que está siendo throttled.
  const ip = getIp(req);
  const rl = await rateLimit(`centinela:report-error:${ip}`, RL_MAX_HITS, RL_WINDOW_SEC);
  if (!rl.allowed) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body: ErrorPayload = await req.json();

    // Validar shape mínimo
    if (!body.source || !body.route || !body.error_message) {
      return new NextResponse(null, { status: 204 });
    }

    const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
    const sessionSecret = process.env.SESSION_SECRET || "dev-secret";

    // Construir payload para backend
    const payload = JSON.stringify({
      source: body.source,
      route: body.route,
      error_message: body.error_message,
      stack: body.stack,
      digest: body.digest,
      user_agent: req.headers.get("user-agent") || "",
    });

    // HMAC para autenticación
    const signature = computeHMAC(payload, sessionSecret);

    // Forward al backend
    const backendRes = await fetch(
      `${backendUrl}/api/v1/centinela/report-error`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth": `v1 ${signature}`,
        },
        body: payload,
      }
    ).catch((err) => {
      console.warn("[centinela proxy] backend fetch failed:", err);
      return null;
    });

    // Siempre devuelve 204 para no leak info al cliente
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.warn("[centinela proxy] parse error:", err);
    return new NextResponse(null, { status: 204 });
  }
}
