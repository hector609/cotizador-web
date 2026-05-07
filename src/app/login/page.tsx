"use client";

import Link from "next/link";
import { useState } from "react";

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
          <p className="text-slate-600 mt-2">Cotizador Telcel</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {/* Telegram Login */}
          <button
            onClick={() => alert("Login con Telegram: configurar widget de BotFather")}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#229ED9] text-white font-semibold rounded-lg hover:bg-[#1a87bd] transition mb-4"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
            </svg>
            Iniciar con Telegram
          </button>

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
