import { NextResponse } from "next/server";

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * STUB inicial — todavía no conecta al backend. Cuando esté listo:
 * 1. Llamar al backend Fly.io: POST cmdemobot.fly.dev/api/auth/login
 *    con email + password, recibe JWT.
 * 2. Setear cookie firmada.
 * 3. Redirect 302 a /dashboard.
 *
 * Por ahora valida formato y devuelve "no implementado" claro.
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = (body.email || "").trim();
  const password = body.password || "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y contraseña son requeridos" },
      { status: 400 }
    );
  }

  if (!email.includes("@")) {
    return NextResponse.json(
      { error: "Email no parece válido" },
      { status: 400 }
    );
  }

  // TODO: conectar con backend Fly.io
  // const upstream = await fetch("https://cmdemobot.fly.dev/api/auth/login", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ email, password }),
  // });
  // if (!upstream.ok) return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  // const { token } = await upstream.json();
  // const res = NextResponse.json({ ok: true });
  // res.cookies.set("session", token, { httpOnly: true, secure: true, sameSite: "strict" });
  // return res;

  return NextResponse.json(
    {
      error:
        "Login en construcción. Mientras tanto usa el bot Telegram @CMdemobot",
    },
    { status: 501 }
  );
}
