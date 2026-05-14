import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";
import type { CrearCotizacionResponse } from "@/types/cotizacion";

/**
 * POST /api/cotizaciones/excel — proxy autenticado para subir Excel multi-perfil.
 *
 * Recibe `multipart/form-data` con un campo `file` (el .xlsx llenado), lo
 * convierte a base64 y reenvía al backend como JSON. Esto evita
 * implementar parser multipart en el bot (http.server) y respeta el cap
 * de 4MB de body que ya maneja el bot.
 *
 * Respuesta (202): `{ cotizacion: { id, estado, ... } }` — mismo shape que
 * POST /api/cotizaciones (el frontend ya lo sabe pollear con
 * GET /api/cotizaciones/{id}).
 *
 * SECURITY:
 *  - Cookie de sesión obligatoria.
 *  - Cap del archivo a 2MB (mismo cap que el bot/Telegram).
 *  - Solo aceptamos extensión .xlsx/.xlsm — el bot también valida con
 *    openpyxl.load_workbook (defensa en profundidad).
 */

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  // Parsear multipart. Next/Web standards: request.formData().
  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    console.error("[api/cotizaciones/excel POST] formData parse", e);
    return errJson("Formulario inválido", 400);
  }

  const fileEntry = form.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return errJson("Archivo requerido (campo 'file')", 400);
  }
  const file = fileEntry as File;

  if (file.size > MAX_FILE_BYTES) {
    return errJson("Archivo muy grande (>2MB)", 400);
  }
  if (file.size < 100) {
    return errJson("Archivo vacío o corrupto", 400);
  }

  const fname = (file.name || "").toLowerCase();
  if (!fname.endsWith(".xlsx") && !fname.endsWith(".xlsm")) {
    return errJson("El archivo debe ser .xlsx o .xlsm", 400);
  }

  // Leer el binario y convertir a base64. Buffer está disponible en el
  // runtime Node.js de Next route handlers (default).
  const buf = Buffer.from(await file.arrayBuffer());
  const fileB64 = buf.toString("base64");

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/cotizaciones/excel POST] sign error", e);
    return errJson("Estamos realizando tareas de mantenimiento. Intenta en unos minutos.", 500);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/cotizaciones/excel`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_b64: fileB64, filename: file.name }),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api/cotizaciones/excel POST] backend fetch error", e);
    return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errJson("No tienes acceso a este recurso.", 403);
  }
  if (upstream.status === 400 || upstream.status === 422) {
    let msg = "Los datos no son válidos. Verifica los campos.";
    try {
      const data = await upstream.json();
      if (typeof data?.error === "string" && data.error.length < 500) {
        msg = data.error;
      }
    } catch {
      // ignore
    }
    return errJson(msg, 400);
  }
  if (upstream.status >= 500) return errJson("No pudimos cargar tus datos. Reintenta en unos segundos.", 502);
  if (!upstream.ok) return errJson("Algo salió mal. Reintenta o contacta a soporte.", 502);

  let data: CrearCotizacionResponse;
  try {
    data = (await upstream.json()) as CrearCotizacionResponse;
  } catch (e) {
    console.error("[api/cotizaciones/excel POST] json parse", e);
    return errJson("Respuesta inesperada del servidor. Reintenta.", 502);
  }

  return NextResponse.json(data, { status: 202 });
}
