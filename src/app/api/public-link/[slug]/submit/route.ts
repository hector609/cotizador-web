/**
 * POST /api/public-link/[slug]/submit
 *
 * Proxy thin al backend bot. No auth required — endpoint público.
 * Reenvia el body del cliente al upstream y devuelve la respuesta tal cual.
 *
 * Por qué proxy y no llamada directa al bot desde el browser:
 *  - La CSP de next.config.ts solo permite connect-src a 'self' y *.fly.dev,
 *    pero en móvil el link de `cotizador.hectoria.mx` también está en CSP.
 *    Usar un proxy evita cualquier problema de CORS + CSP y centraliza
 *    cualquier lógica de logging / rate-limit adicional que queramos en el futuro.
 *  - IP forwarding: el backend necesita la IP REAL del cliente final para
 *    aplicar el rate limit 5 req/IP/15min. Reenviamos X-Forwarded-For.
 */

import { NextRequest, NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";

// Slug whitelist defensivo: base32-ish, 6-12 chars.
const SLUG_RE = /^[A-Z2-9]{6,12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  // Reenviar IP real al backend para que el rate limit sea por cliente, no por
  // la IP del servidor de Next.js.
  const forwardedFor =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";

  let upstream: Response;
  try {
    upstream = await fetch(
      `${BOT_API_URL}/api/v1/public-link/${encodeURIComponent(slug)}/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Forwarded-For": forwardedFor,
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Backend no disponible. Intenta en unos momentos." },
      { status: 502 },
    );
  }

  // Pasar status y body tal cual para que el cliente pueda manejar 429, 410, etc.
  const upstreamBody = await upstream.text();
  return new NextResponse(upstreamBody, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
