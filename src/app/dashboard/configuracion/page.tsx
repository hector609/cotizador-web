"use client";

/**
 * /dashboard/configuracion — el distribuidor sube/actualiza sus creds Telcel.
 *
 * REDISEÑO LUMINA Light Premium (pivot 2026-05-13). Antes usaba `DashboardNav`
 * legacy + botones `bg-blue-700` saturados; ahora consume el `Sidebar`
 * compartido en paleta indigo/cyan, cards `bg-white rounded-2xl shadow-sm`,
 * pill buttons gradient indigo→cyan, y entrada fade-up con framer-motion.
 *
 * Flujo (intacto):
 *   1. Mount → GET /api/tenant/credentials (proxy a bot meta endpoint).
 *      Muestra estado actual: usuario enmascarado + tiene_password + actualizado.
 *   2. Form submit → POST /api/tenant/credentials con {usuario, password}.
 *      El bot cifra con master key y persiste en tenant_config.json.
 *
 * Defensa: el password va en plain text por la red (sobre HTTPS) y nunca se
 * almacena en estado más allá del tiempo del submit. El bot devuelve solo
 * meta (jamás el password en claro).
 *
 * A11Y: useId + htmlFor + role=alert + aria-describedby para errores.
 */

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
} from "lucide-react";
import { Sidebar, type SidebarKey } from "@/components/admin/Sidebar";

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

  const usuarioId = useId();
  const passwordId = useId();
  const submitErrorId = useId();

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

  // El Sidebar primary nav no incluye "configuracion" (vive en el footer del
  // sidebar). Pasamos "inicio" para que ningún tab principal quede falso
  // active; el link de "Configuración" del sidebar es independiente del
  // active state.
  const sidebarActive = "inicio" as SidebarKey;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar active={sidebarActive} />

      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-10 md:py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <Link
              href="/dashboard"
              className="hover:text-indigo-600 transition"
            >
              Inicio
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">Configuración</span>
          </div>

          {/* H1 */}
          <motion.header
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-md shadow-indigo-200">
                <KeyRound className="w-5 h-5" />
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Credenciales Telcel
              </h1>
            </div>
            <p className="text-sm md:text-base text-slate-600 max-w-2xl">
              Estas credenciales se usan para cotizar a tu nombre. Las{" "}
              <span className="font-semibold text-slate-800">ciframos</span> al
              guardarlas y nunca las mostramos de vuelta. Si cambias el password
              en el portal Telcel, actualízalo aquí.
            </p>
          </motion.header>

          {/* Estado actual */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Estado actual
              </h2>
            </div>

            {loadingMeta ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Leyendo…
              </div>
            ) : metaError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{metaError}</span>
              </div>
            ) : meta && meta.tiene_password ? (
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Usuario
                  </dt>
                  <dd className="font-mono text-slate-900">
                    {meta.usuario || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Password
                  </dt>
                  <dd className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Configurado
                  </dd>
                </div>
                {meta.actualizado && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Actualizado
                    </dt>
                    <dd className="text-slate-700">{meta.actualizado}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Aún no has configurado credenciales Telcel. Sin esto, las
                  cotizaciones no van a poder correr.
                </span>
              </div>
            )}
          </motion.section>

          {/* Form */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
            className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 md:p-8"
          >
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              {meta && meta.tiene_password
                ? "Actualizar credenciales"
                : "Configurar credenciales"}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Ingresa el email y password con los que entras al portal Telcel.
            </p>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor={usuarioId}
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Usuario Telcel (email)
                  <span className="text-rose-500 ml-0.5">*</span>
                </label>
                <input
                  id={usuarioId}
                  type="email"
                  autoComplete="off"
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="distribuidor@telcel.com"
                  aria-describedby={submitError ? submitErrorId : undefined}
                  className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition"
                />
              </div>

              <div>
                <label
                  htmlFor={passwordId}
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Password Telcel
                  <span className="text-rose-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    id={passwordId}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={4}
                    maxLength={256}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby={submitError ? submitErrorId : undefined}
                    className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-12 text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Ocultar password" : "Mostrar password"
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Lo ciframos antes de guardarlo. No se almacena en plano.
                </p>
              </div>

              {submitError && (
                <div
                  id={submitErrorId}
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
              {submitOk && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Credenciales guardadas.</span>
                </div>
              )}

              <div className="pt-2">
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={!submitting ? { scale: 1.02 } : undefined}
                  whileTap={!submitting ? { scale: 0.98 } : undefined}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar credenciales
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
