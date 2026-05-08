"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  LockClosedIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { TrustSignals } from "@/components/ui/TrustSignals";

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
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
          >
            <ArrowRightIcon className="w-4 h-4 rotate-180 mr-1" />
            Volver
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">
            Entra a tu cotizador.
          </h1>
          <p className="text-slate-600 mt-2">
            Distribuidores autorizados: usa Telegram para entrar en un toque, o
            tu email si prefieres.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {/* Telegram Login Widget oficial. Dominio aprobado en BotFather:
              cotizador.hectoria.mx. El script se inyecta desde useEffect
              (React no ejecuta scripts via dangerouslySetInnerHTML). */}
          <div
            ref={telegramContainerRef}
            className="flex justify-center mb-2 min-h-[44px]"
          />
          <p className="text-xs text-center text-slate-400 mb-4">
            El widget de Telegram no cargó. Puede ser un bloqueador de anuncios
            o tu red corporativa — desactívalo para este sitio o entra con email.
          </p>

          <div className="flex items-center my-6">
            <div className="flex-grow border-t border-slate-200" />
            <span className="px-3 text-xs text-slate-500 uppercase">o con email</span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@distribuidor.mx"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50 transition"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-6 leading-relaxed">
            ¿Todavía sin cuenta? Pide tu acceso y te respondemos en menos de 24
            horas hábiles. Escríbenos a{" "}
            <a
              href="mailto:hola@hectoria.mx"
              className="text-blue-700 font-semibold hover:underline"
            >
              hola@hectoria.mx
            </a>{" "}
            o por DM en{" "}
            <a
              href="https://instagram.com/hectoria.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 font-semibold hover:underline"
            >
              @hectoria.mx
            </a>
            . Si eres distribuidor autorizado del operador líder en México, el
            alta es inmediata tras validar tu RFC.
          </p>
        </div>

        {/* Trust signals — reassure users right before they enter credentials. */}
        <TrustSignals
          className="mt-6"
          items={[
            { icon: MapPinIcon, label: "Datos en México" },
            { icon: LockClosedIcon, label: "Cifrado en tránsito" },
            { icon: ShieldCheckIcon, label: "RFC nunca expuesto" },
          ]}
        />
      </div>
    </main>
  );
}
