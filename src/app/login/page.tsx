"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  LockClosedIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from "@/components/icons";

const TELEGRAM_BOT_USERNAME = "CMdemobot";

// Type augmentation: el callback global que el widget de Telegram llama.
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Mensajes de error según copy/login.md sección 3. Un mapa local evita que el
// servidor tenga que conocer el wording final y mantiene el "qué hacer ahora"
// del usuario aquí, junto a la UI.
function friendlyAuthError(serverError: string | undefined): string {
  const msg = (serverError || "").toLowerCase();
  if (
    msg.includes("credencial") ||
    msg.includes("credentials") ||
    msg.includes("invalid") ||
    msg.includes("password") ||
    msg.includes("unauthorized")
  ) {
    return "Email o contraseña no coinciden. Revisa que no haya espacios o mayúsculas de más, o entra con Telegram si prefieres.";
  }
  if (msg.includes("pending") || msg.includes("rfc") || msg.includes("activ")) {
    return "Tu cuenta aún no está activada. Validamos tu RFC en horas hábiles — si han pasado más de 24h, escríbenos a hola@hectoria.mx con el asunto 'alta pendiente'.";
  }
  return serverError && serverError.trim().length > 0
    ? serverError
    : "Email o contraseña no coinciden. Revisa que no haya espacios o mayúsculas de más, o entra con Telegram si prefieres.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const telegramContainerRef = useRef<HTMLDivElement>(null);

  // IDs estables para asociar <label htmlFor> y aria-describedby (A11Y A3/A4).
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  // Inyectar el script del widget Telegram en el DOM real (React no ejecuta
  // scripts insertados con dangerouslySetInnerHTML). Y registrar el callback
  // global que el widget invocará al autenticar.
  useEffect(() => {
    // Callback global que el widget invoca con los datos del usuario.
    window.onTelegramAuth = async (user: TelegramUser) => {
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        if (!res.ok) {
          setError(
            "Tu sesión de Telegram expiró antes de poder validarla. Vuelve a tocar el botón de Telegram para intentar de nuevo.",
          );
          return;
        }
        window.location.href = "/dashboard";
      } catch {
        setError(
          "No pudimos conectar con el servidor. Revisa tu internet y vuelve a intentar; si sigue, avísanos en @hectoria.mx.",
        );
      }
    };

    // Inyectar el <script> real del widget Telegram.
    const container = telegramContainerRef.current;
    if (!container) return;
    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(friendlyAuthError(data.error));
      }
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      // Error de red (fetch lanza TypeError cuando no hay conexión) vs error
      // ya formateado por el throw de arriba.
      if (e instanceof TypeError) {
        setError(
          "No pudimos conectar con el servidor. Revisa tu internet y vuelve a intentar; si sigue, avísanos en @hectoria.mx.",
        );
      } else {
        setError(e instanceof Error ? e.message : friendlyAuthError(undefined));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Columna izquierda: formulario */}
      <section className="flex flex-col px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowRightIcon className="w-4 h-4 rotate-180 mr-1.5" aria-hidden />
            Volver al inicio
          </Link>
        </div>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-md mx-auto">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Entra a tu cotizador.
            </h1>
            <p className="text-slate-600 mt-3 leading-relaxed">
              Distribuidores autorizados: usa Telegram para entrar en un toque,
              o tu email si prefieres.
            </p>

            <div className="mt-8 space-y-6">
              {/* Telegram Login Widget oficial. Dominio aprobado en BotFather:
                  cotizador.hectoria.mx. El script se inyecta desde useEffect
                  (React no ejecuta scripts via dangerouslySetInnerHTML). */}
              <div>
                <div
                  ref={telegramContainerRef}
                  className="flex justify-center min-h-[44px]"
                />
                <p className="text-xs text-center text-slate-400 mt-2">
                  ¿No ves el botón de Telegram? Puede ser un bloqueador o tu red
                  corporativa — desactívalo o entra con email.
                </p>
              </div>

              <div className="flex items-center" aria-hidden>
                <div className="flex-grow border-t border-slate-200" />
                <span className="px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  o con email
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor={emailId}
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id={emailId}
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@distribuidor.mx"
                    autoComplete="email"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 transition"
                  />
                </div>
                <div>
                  <label
                    htmlFor={passwordId}
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Contraseña
                  </label>
                  <input
                    id={passwordId}
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 transition"
                  />
                </div>

                {error && (
                  <p
                    id={errorId}
                    role="alert"
                    className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg py-2.5 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <p className="text-xs text-slate-500 text-center leading-relaxed">
                ¿Todavía sin cuenta?{" "}
                <Link
                  href="/signup"
                  className="text-blue-700 font-semibold hover:underline"
                >
                  Pide tu acceso
                </Link>{" "}
                — respondemos en menos de 24h hábiles. O escríbenos a{" "}
                <a
                  href="mailto:hola@hectoria.mx"
                  className="text-blue-700 font-semibold hover:underline"
                >
                  hola@hectoria.mx
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Columna derecha: prueba social + trust signals (oculto en mobile) */}
      <aside className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-12 py-14 border-l border-slate-200">
        <div className="max-w-md">
          <figure className="rounded-2xl bg-white border border-slate-200 shadow-sm p-7">
            <blockquote className="text-base text-slate-700 leading-relaxed">
              &ldquo;Pasé de tardar 15 minutos por cotización a menos de uno.
              Ahora puedo atender más clientes corporativos sin contratar otro
              vendedor.&rdquo;
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-semibold">
                JC
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Jesús Cárdenas
                </p>
                <p className="text-xs text-slate-500">
                  Celumaster — Distribuidor autorizado
                </p>
              </div>
            </figcaption>
          </figure>

          <ul className="mt-8 space-y-3">
            <li className="flex items-start gap-3">
              <MapPinIcon
                className="w-5 h-5 text-blue-700 mt-0.5 shrink-0"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Datos en México
                </p>
                <p className="text-xs text-slate-500">
                  Servidores y respaldos dentro del territorio nacional.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <LockClosedIcon
                className="w-5 h-5 text-blue-700 mt-0.5 shrink-0"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Cifrado en tránsito
                </p>
                <p className="text-xs text-slate-500">
                  TLS 1.3 extremo a extremo; credenciales nunca en claro.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircleIcon
                className="w-5 h-5 text-blue-700 mt-0.5 shrink-0"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  RFC nunca expuesto
                </p>
                <p className="text-xs text-slate-500">
                  Tu cartera fiscal queda aislada por tenant.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      {/* Mobile-only trust signals (la columna derecha está oculta) */}
      <div className="lg:hidden px-6 pb-10">
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600">
          <li className="inline-flex items-center gap-1.5">
            <MapPinIcon className="w-4 h-4 text-blue-700" aria-hidden />
            <span>Datos en México</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <LockClosedIcon className="w-4 h-4 text-blue-700" aria-hidden />
            <span>Cifrado en tránsito</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheckIcon className="w-4 h-4 text-blue-700" aria-hidden />
            <span>RFC nunca expuesto</span>
          </li>
        </ul>
      </div>
    </main>
  );
}
