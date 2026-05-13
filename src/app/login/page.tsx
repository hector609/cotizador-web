"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  CheckCircleIcon,
  DocumentTextIcon,
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
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#0b1326] text-white/90 antialiased overflow-x-hidden">
      {/* Columna izquierda: formulario (REVENTAR dark + mesh) */}
      <section
        className="relative flex flex-col px-6 py-10 sm:px-10 lg:px-16 lg:py-14 overflow-hidden"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 0%, rgba(29, 78, 216, 0.18) 0%, transparent 50%),
            radial-gradient(circle at 80% 90%, rgba(6, 182, 212, 0.12) 0%, transparent 45%),
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "auto, auto, 40px 40px, 40px 40px",
        }}
      >
        <div className="relative z-10 mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-white/60 hover:text-white transition"
          >
            <ArrowRightIcon className="w-4 h-4 rotate-180 mr-1.5" aria-hidden />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-lg font-black tracking-tight text-white">
              Cotizador
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-300/10 border border-emerald-300/30 text-emerald-300 text-[10px] font-semibold uppercase tracking-widest shadow-[0_0_15px_rgba(45,212,191,0.25)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Beta
            </span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex items-center">
          <div className="w-full max-w-md mx-auto">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Bienvenido
            </h1>
            <p className="text-slate-400 mt-3 leading-relaxed">
              Distribuidores autorizados Telcel: usa Telegram para entrar en un
              toque, o tu email si prefieres.
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
                <p className="text-xs text-center text-slate-500 mt-2">
                  ¿No ves el botón de Telegram? Puede ser un bloqueador o tu red
                  corporativa — desactívalo o entra con email.
                </p>
              </div>

              <div className="flex items-center" aria-hidden>
                <div className="flex-grow border-t border-white/10" />
                <span className="px-3 text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                  o con email
                </span>
                <div className="flex-grow border-t border-white/10" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor={emailId}
                    className="block text-xs font-medium tracking-widest text-slate-500 uppercase mb-2"
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
                    className="w-full bg-white/5 backdrop-blur border border-white/10 rounded-lg px-4 py-3 text-white/90 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition"
                  />
                </div>
                <div>
                  <label
                    htmlFor={passwordId}
                    className="block text-xs font-medium tracking-widest text-slate-500 uppercase mb-2"
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
                    className="w-full bg-white/5 backdrop-blur border border-white/10 rounded-lg px-4 py-3 text-white/90 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition"
                  />
                </div>

                {error && (
                  <p
                    id={errorId}
                    role="alert"
                    className="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2.5"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-br from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <p className="text-sm text-slate-400 text-center leading-relaxed">
                ¿No tienes cuenta?{" "}
                <Link
                  href="/signup"
                  className="text-cyan-300 font-semibold hover:underline"
                >
                  Regístrate
                </Link>{" "}
                — respondemos en menos de 24h hábiles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Columna derecha: slice del producto (oculto en mobile) */}
      <aside
        className="hidden lg:flex relative flex-col justify-center px-12 py-14 border-l border-white/10 overflow-hidden bg-[#060e20]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 70% 20%, rgba(29, 78, 216, 0.22) 0%, transparent 50%),
            radial-gradient(circle at 20% 80%, rgba(45, 212, 191, 0.14) 0%, transparent 45%),
            radial-gradient(circle at 90% 70%, rgba(6, 182, 212, 0.12) 0%, transparent 40%),
            linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "auto, auto, auto, 40px 40px, 40px 40px",
        }}
      >
        <LoginVisual />
        <div className="relative z-10 mt-auto pt-10 text-xs text-slate-500">
          Hecho en MX 🇲🇽
        </div>
      </aside>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* LoginVisual — slice REAL del producto con folio 2378845 + palancas      */
/* Simplificación del ChatMockup de la landing (no exportado).             */
/* ---------------------------------------------------------------------- */

function LoginVisual() {
  return (
    <div className="relative z-10 max-w-md mx-auto w-full">
      {/* Floating folio badge */}
      <div className="absolute -top-4 -left-4 z-20 flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[#0b1326]">
          <CheckCircleIcon className="w-5 h-5" />
        </span>
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold leading-none">
            Folio
          </div>
          <div className="text-sm font-mono font-semibold text-white leading-tight">
            2378845
          </div>
        </div>
      </div>

      {/* Floating palancas card */}
      <div className="absolute -right-4 -bottom-4 z-20 w-52 bg-white/5 backdrop-blur-md border border-cyan-300/20 rounded-2xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] rotate-3">
        <div className="flex items-center gap-2 mb-3">
          <BoltIcon className="w-5 h-5 text-cyan-300" />
          <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            Palancas
          </div>
        </div>
        <ul className="space-y-2 text-xs text-white/80">
          <li className="flex items-center justify-between">
            <span>Descuento</span>
            <span className="font-mono font-semibold text-white">35%</span>
          </li>
          <li className="flex items-center justify-between">
            <span>A/B mensual</span>
            <span className="font-mono font-semibold text-white">92%</span>
          </li>
        </ul>
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-emerald-300">
          <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
          +18.4% margen
        </div>
      </div>

      {/* Main card: cotización completada */}
      <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_0_60px_rgba(6,182,212,0.15)]">
        <div className="flex items-center gap-3 mb-5">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <DocumentTextIcon className="w-5 h-5 text-white" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-bold text-white leading-tight">
              Cotización lista
            </div>
            <div className="text-xs text-white/50 mt-0.5">
              5 líneas · 24 meses · A/B 92%
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-400/15 text-emerald-300 border border-emerald-300/20">
            Completada
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/10">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
              Total mensual
            </div>
            <div className="text-xl font-bold text-white font-mono mt-1">
              $80,067.50
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
              Margen
            </div>
            <div className="text-xl font-bold font-mono mt-1 text-emerald-300">
              18.4%
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2.5 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <DocumentTextIcon className="w-3.5 h-3.5" />
            PDF cliente
          </span>
          <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white/80 bg-white/5 border border-white/10 px-3 py-2.5 rounded-lg">
            <DocumentTextIcon className="w-3.5 h-3.5" />
            PDF interno
          </span>
        </div>
      </div>

      {/* Testimonial */}
      <figure className="mt-10 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
        <blockquote className="text-sm text-white/80 leading-relaxed">
          &ldquo;El bot me cotiza en 2 minutos lo que en Excel me tomaba hora y
          media.&rdquo;
        </blockquote>
        <figcaption className="mt-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 text-white flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            JC
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Jesús Cárdenas</p>
            <p className="text-xs text-slate-400">
              Celumaster — Distribuidor autorizado
            </p>
          </div>
        </figcaption>
      </figure>
    </div>
  );
}
