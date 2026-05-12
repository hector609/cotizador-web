import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 *
 * Cierra sesión limpiando la cookie `session`. No requiere body ni
 * autenticación previa — invocar dos veces es no-op. La response es
 * `{ ok: true, redirect: "/login" }` para que el cliente pueda redirigir
 * después del fetch.
 *
 * Implementación: seteamos la cookie con maxAge=0 + valor vacío. El path/
 * sameSite/secure deben coincidir con los flags usados al firmar la sesión
 * (ver `auth/login/route.ts`) para que el navegador la sobreescriba.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true, redirect: "/login" });
  res.cookies.set("session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}
