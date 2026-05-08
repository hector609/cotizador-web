"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
          const data = await res.json().catch(() => ({}));
          setError(`Login Telegram falló: ${data.error || "error desconocido"}`);
          return;
        }
        window.location.href = "/dashboard";
      } catch (e: unknown) {
        setError(`Error de red: ${e instanceof Error ? e.message : "desconocido"}`);
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
        throw new Error(data.error || "Credenciales incorrectas");
      }
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado");
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
            className="inline-block text-sm text-slate-500 hover:text-slate-700 mb-4"
          >
            ← Volver
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Iniciar sesión</h1>
          <p className="text-slate-600 mt-2">Cotizador Inteligente para DATS</p>
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
            Si no aparece el botón, verifica que tu navegador no bloquee Telegram
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

          <p className="text-xs text-slate-500 text-center mt-6">
            ¿Aún no tienes acceso? Solicita una demo en{" "}
            <a
              href="mailto:hola@hectoria.mx"
              className="text-blue-700 font-semibold hover:underline"
            >
              hola@hectoria.mx
            </a>{" "}
            o por{" "}
            <a
              href="https://instagram.com/hectoria.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 font-semibold hover:underline"
            >
              Instagram
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
