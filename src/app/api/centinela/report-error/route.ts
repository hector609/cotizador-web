/**
 * /api/centinela/report-error — proxy que forwardea errores web al backend.
 * Devuelve 204 always (no leak info).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
