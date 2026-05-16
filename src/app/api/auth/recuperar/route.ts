/**
 * POST /api/auth/recuperar — inicia el flujo de recuperación de contraseña.
 *
 * Seguridad: SIEMPRE responde 200 con { ok: true }, independiente de si el
 * email existe o no. Esto evita enumeración de usuarios (user enumeration).
 *
 * Flujo:
 *   1. Validar formato de email.
 *   2. Forwardear a `POST ${BOT_API_URL}/api/v1/auth/recuperar` con X-Auth HMAC.
 *   3. Si el bot responde error: loggear silenciosamente, NO exponer al cliente.
 *   4. Devolver 200 { ok: true } en cualquier caso.
 *
 * TODO(bot): El endpoint `POST /api/v1/auth/recuperar` en el backend aún no
 * está implementado. Cuando se implemente debe:
 *   - Buscar el `distribuidor_id` / `vendedor_id` por email.
 *   - Generar un token de reset con TTL 1h y persistirlo en BD.
 *   - Enviar email con link de reset `https://cotizador.hectoria.mx/nueva-contrasena?token=...`.
 *   - Retornar 200 OK (o 204) siempre, sin revelar si el email existe.
 */

import { NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

// Regex básico: cualquier dirección con @ y dominio con punto.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Respuesta neutral siempre — no leakear existencia del email.
const OK_RESPONSE = NextResponse.json({ ok: true }, { status: 200 });

function signRecuperarRequest(): { "X-Auth": string } | Record<string, never> {
  try {
    // Importar lazy para no romper build sin SESSION_SECRET.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signBackendRequest } = require("@/lib/backend-auth") as {
      signBackendRequest: (id: number) => { "X-Auth": string };
    };
    // distribuidor_id=0: el backend debe aceptar este endpoint sin tenant scope
    // ya que el usuario aún no está autenticado.
    return signBackendRequest(0);
  } catch {
    console.warn("[api/auth/recuperar] No se pudo firmar X-Auth (SESSION_SECRET ausente).");
    return {};
  }
}

export async function POST(request: Request) {
  let email: string;
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    // Responder 200 neutral — no revelar nada al cliente.
    return OK_RESPONSE;
  }

  // Validación básica de formato. Si el email no tiene formato válido, no
  // molestamos al backend — respondemos 200 igual para no dar señal.
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return OK_RESPONSE;
  }

  // Intentar notificar al backend. Fail silencioso = no exponer al cliente.
  const authHeader = signRecuperarRequest();
  try {
    const upstream = await fetch(`${BOT_API_URL}/api/v1/auth/recuperar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeader,
      },
      body: JSON.stringify({ email }),
      cache: "no-store",
      // Timeout corto: el cliente ya recibió "te enviamos instrucciones" optimista.
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      // Loggear sin exponer al cliente.
      console.warn(
        `[api/auth/recuperar] backend respondió ${upstream.status} para email hash`,
        email.replace(/[^@]/g, "*"), // loguear dominio solo, no el usuario
      );
    }
  } catch (err) {
    // Backend caído, timeout, o endpoint no implementado aún — log y continuar.
    console.error("[api/auth/recuperar] fetch al backend falló:", err);
  }

  // SIEMPRE responder 200 { ok: true }. No confirmar si el email existe.
  return OK_RESPONSE;
}
