import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

/**
 * POST /api/cotizaciones/from-pdf — proxy autenticado para re-cotizar desde PDF.
 *
 * Acepta JSON con `file_b64` (PDF en base64) y opcionalmente:
 *   - `target_ab`: número — AB objetivo para re-cotizar con rentabilidad diferente
 *   - `override_rfc`, `override_tramite`, `override_plazo`, `override_plan`:
 *     campos que el usuario completó manualmente tras extracción parcial.
 *
 * Respuestas posibles del backend:
 *   - 202: {"cotizacion": {id, estado: "pendiente", ...}} — extracción completa, job spawneado.
 *   - 200: {"partial": true, "datos_extraidos": {...}, "campos_faltantes": [...]} — faltan datos.
 *   - 400: {"error": "..."} — PDF inválido, encriptado o sin texto.
 *
 * El proxy reenvía sin modificar la respuesta 200 partial al frontend para que
 * muestre el formulario de datos faltantes.
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB — PDFs pueden ser más pesados que xlsx

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errJson("JSON inválido", 400);
  }

  const fileB64 = body.file_b64;
  if (typeof fileB64 !== "string" || !fileB64) {
    return errJson("file_b64 requerido", 400);
  }

  // Cap del PDF decodificado (estimación: base64 ~ 4/3 del binario)
  if (fileB64.length > Math.ceil(MAX_FILE_BYTES * 1.4)) {
    return errJson("Archivo muy grande (>20MB)", 400);
  }

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/cotizaciones/from-pdf POST] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  // Construir payload para el backend — pasar todos los campos que el frontend manda
  const backendPayload: Record<string, unknown> = { file_b64: fileB64 };
  if (typeof body.target_ab === "number") backendPayload.target_ab = body.target_ab;
  // Overrides manuales del usuario (modo partial)
  const overrideKeys = ["override_rfc", "override_tramite", "override_plazo", "override_plan"] as const;
  for (const k of overrideKeys) {
    if (body[k] !== undefined && body[k] !== null && body[k] !== "") {
      backendPayload[k] = body[k];
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/cotizaciones/from-pdf`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendPayload),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/cotizaciones/from-pdf POST] backend fetch error", e);
    return errJson("No pudimos conectar con el servidor. Reintenta en unos segundos.", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No tienes acceso a este recurso.", 403);
  }
  if (upstream.status === 400 || upstream.status === 422) {
    let msg = "El PDF no es válido o no pudimos procesarlo.";
    try {
      const data = await upstream.json() as { error?: string };
      if (typeof data?.error === "string" && data.error.length < 500) msg = data.error;
    } catch { /* ignore */ }
    return errJson(msg, 400);
  }
  if (upstream.status >= 500) return errJson("Error interno. Reintenta o contacta a soporte.", 502);

  // Pasar la respuesta del backend al frontend — puede ser 200 (partial) o 202 (job)
  let data: unknown;
  try {
    data = await upstream.json();
  } catch (e) {
    console.error("[api/cotizaciones/from-pdf POST] json parse", e);
    return errJson("Respuesta inesperada del servidor. Reintenta.", 502);
  }

  return NextResponse.json(data, { status: upstream.status });
}
