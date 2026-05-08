import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * POST /api/experto
 *
 * Proxy autenticado al backend del bot para parseo en lenguaje natural.
 * Body JSON: `{ texto: string }`. Reenvía a
 * `${BOT_API_URL}/api/v1/experto` y devuelve el dict parseado por Claude
 * (marca, modelo, líneas, plan, plazo, rfc, missing_fields, confidence, ...).
 *
 * SECURITY:
 *  - Limitamos `texto` a 2000 chars para evitar abuso del LLM upstream.
 *  - Mismo HMAC X-Auth que los demás proxies.
 *  - 404 upstream → fallback graceful (la UI mostrará "modo experto no
 *    disponible aún").
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";
const MAX_TEXTO_LEN = 2000;

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

interface ExpertoRequestBody {
  texto?: unknown;
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("No autenticado", 401);

  let body: ExpertoRequestBody;
  try {
    body = (await request.json()) as ExpertoRequestBody;
  } catch {
    return errJson("JSON inválido", 400);
  }

  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (!texto) {
    return errJson("Campo `texto` requerido", 400);
  }
  if (texto.length > MAX_TEXTO_LEN) {
    return errJson(`Texto excede ${MAX_TEXTO_LEN} caracteres`, 400);
  }

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/experto] sign error", e);
    return errJson("Servicio no disponible", 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/experto`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ texto }),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/experto] backend fetch error", e);
    return errJson("Backend no disponible", 502);
  }

  if (upstream.status === 404) {
    return NextResponse.json(
      {
        unavailable: true,
        error:
          "Modo experto aún no disponible en el backend. Usa el modo Wizard.",
      },
      { status: 200 },
    );
  }
  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No autorizado", 403);
  }
  if (upstream.status === 400 || upstream.status === 422) {
    let msg = "No pudimos interpretar el texto";
    try {
      const data = await upstream.json();
      if (typeof data?.error === "string" && data.error.length < 200) {
        msg = data.error;
      }
    } catch {
      // ignore
    }
    return errJson(msg, 400);
  }
  if (upstream.status >= 500) return errJson("Backend no disponible", 502);
  if (!upstream.ok) return errJson("Error en backend", 502);

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("[api/experto] json parse", e);
    return errJson("Respuesta inválida del backend", 502);
  }
}
