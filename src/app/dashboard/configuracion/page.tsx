"use client";

/**
 * /dashboard/configuracion — el distribuidor sube/actualiza sus creds Telcel.
 *
 * Flujo:
 *   1. Mount → GET /api/tenant/credentials (proxy a bot meta endpoint).
 *      Muestra estado actual: usuario enmascarado + tiene_password + actualizado.
 *   2. Form submit → POST /api/tenant/credentials con {usuario, password}.
 *      El bot cifra con master key y persiste en tenant_config.json.
 *
 * Defensa: el password va en plain text por la red (sobre HTTPS) y nunca se
 * almacena en estado más allá del tiempo del submit. El bot devuelve solo
 * meta (jamás el password en claro).
 */

import { useEffect, useState } from "react";
import { DashboardNav } from "../_nav";

interface CredsMeta {
  usuario: string; // enmascarado, ej "j***@empresa.com"
  tiene_password: boolean;
  actualizado: string; // ISO o ""
}

export default function ConfiguracionPage() {
  const [meta, setMeta] = useState<CredsMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  async function loadMeta() {
    setLoadingMeta(true);
    setMetaError(null);
    try {
      const res = await fetch("/api/tenant/credentials", {
        method: "GET",
        cache: "no-store",
      });
      if (res.status === 401) {
        // No autenticado → mandamos a login.
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setMetaError("No se pudo leer el estado de las credenciales.");
        return;
      }
      const data = (await res.json()) as CredsMeta;
      setMeta(data);
    } catch {
      setMetaError("Error de red leyendo el estado.");
    } finally {
      setLoadingMeta(false);
    }
  }

  useEffect(() => {
    void loadMeta();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitOk(false);

    const u = usuario.trim();
    if (!u || !u.includes("@")) {
      setSubmitError("El usuario debe ser un email válido.");
      return;
    }
    if (password.length < 4 || password.length > 256) {
      setSubmitError("Password fuera de rango (4-256 caracteres).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tenant/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: u, password }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(data.error || "No se pudieron guardar las credenciales.");
        return;
      }
      setSubmitOk(true);
      setPassword(""); // borrar password del estado tras éxito.
      await loadMeta();
    } catch {
      setSubmitError("Error de red al guardar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav />

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Credenciales del portal Telcel
        </h2>
        <p className="text-slate-600 mb-8">
          Estas credenciales se usan para cotizar a tu nombre. Se cifran al
          guardarlas y nunca las mostramos de vuelta. Si cambias el password en
          el portal Telcel, actualízalo aquí.
        </p>

        <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Estado actual
          </h3>
          {loadingMeta ? (
            <p className="text-sm text-slate-500">Leyendo…</p>
          ) : metaError ? (
            <p className="text-sm text-red-700">{metaError}</p>
          ) : meta && meta.tiene_password ? (
            <ul className="text-sm text-slate-700 space-y-1">
              <li>
                <span className="text-slate-500">Usuario:</span>{" "}
                <span className="font-mono">{meta.usuario || "—"}</span>
              </li>
              <li>
                <span className="text-slate-500">Password:</span>{" "}
                <span className="text-emerald-700 font-medium">
                  configurado
                </span>
              </li>
              {meta.actualizado && (
                <li>
                  <span className="text-slate-500">Actualizado:</span>{" "}
                  <span>{meta.actualizado}</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-amber-700">
              Aún no has configurado credenciales Telcel. Sin esto, las
              cotizaciones no van a poder correr.
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            {meta && meta.tiene_password
              ? "Actualizar credenciales"
              : "Configurar credenciales"}
          </h3>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">
                Usuario Telcel (email)
                <span className="text-red-600 ml-0.5">*</span>
              </span>
              <input
                type="email"
                autoComplete="off"
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="distribuidor@telcel.com"
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">
                Password Telcel
                <span className="text-red-600 ml-0.5">*</span>
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={4}
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-700 hover:text-blue-900 px-2 py-1"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <span className="block text-xs text-slate-500 mt-1">
                Lo ciframos antes de guardarlo. No se almacena en plano.
              </span>
            </label>

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {submitError}
              </div>
            )}
            {submitOk && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Credenciales guardadas.
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Guardando…" : "Guardar credenciales"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
