"use client";

import Link from "next/link";
import Script from "next/script";
import { useState } from "react";

const TELEGRAM_BOT_USERNAME = "CMdemobot";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <p className="text-slate-600 mt-2">Cotizador Telc...</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {/* Telegram Login Widget oficial. Dominio aprobado en BotFather:
              cotizador.hectoria.mx. data-onauth llama a window.onTelegramAuth
              definido abajo. */}
          <div
            className="flex justify-center mb-4"
            dangerouslySetInnerHTML={{
              __html: `
              <script async
                src="https://telegram.org/js/telegram-widget.js?22"
                data-telegram-login="${TELEGRAM_BOT_USERNAME}"
                data-size="large"
                data-radius="8"
                data-onauth="onTelegramAuth(user)"
                data-request-access="write"></script>
            `,
            }}
          />

          <Script id="telegram-callback" strategy="afterInteractive">
            {`
              window.onTelegramAuth = async function(user) {
                try {
                  const res = await fetch("/api/auth/telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(user),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    alert("Login Telegram falló: " + (data.error || "error desconocido"));
                    return;
                  }
                  window.location.href = "/dashboard";
                } catch (e) {
                  alert("Error de red: " + e.message);
                }
              };
            `}
          </Script>

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
            ¿No tienes cuenta? Pídela a tu administrador.
          </p>
        </div>
      </div>
    </main>
  );
}
