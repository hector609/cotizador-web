"use client";

/**
 * /signup — solicitud pública de acceso self-service.
 *
 * Bifurca según ?plan=vendedor_telcel:
 *   - vendedor_telcel → form individual (nombre completo, RFC PF 13 chars, correo, tel, telegram)
 *   - distribuidor / sin param → form empresa (RFC empresa + nombre distribuidor + contacto)
 *
 * Submit envía tenant_type al endpoint para que el bot distinga el tipo de cuenta.
 */

import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useId, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from "@/components/icons";

const RFC_EMPRESA_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const RFC_PF_REGEX = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/; // PF: 4 letras + 6 dígitos + 3 = 13 chars
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const TG_USERNAME_REGEX = /^@?[A-Za-z0-9_]{3,32}$/;

function TrialEndDate() {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);
  return (
    <>
      {endDate.toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Form state — distribuidor                                            */
/* ------------------------------------------------------------------ */
interface DistribuidorState {
  email: string;
  rfc_empresa: string;
  nombre_distribuidor: string;
  telefono: string;
  telegram_username: string;
}

const INITIAL_DIST: DistribuidorState = {
  email: "",
  rfc_empresa: "",
  nombre_distribuidor: "",
  telefono: "",
  telegram_username: "",
};

function validateDistribuidor(s: DistribuidorState): string | null {
  if (!EMAIL_REGEX.test(s.email.trim().toLowerCase()))
    return "Email no parece válido. Revisa el formato (ej: tu@empresa.com).";
  if (!RFC_EMPRESA_REGEX.test(s.rfc_empresa.trim().toUpperCase()))
    return "RFC inválido. Debe ser RFC mexicano (12 o 13 caracteres, mayúsculas).";
  const nombre = s.nombre_distribuidor.trim();
  if (nombre.length < 2 || nombre.length > 80)
    return "Nombre del distribuidor debe tener entre 2 y 80 caracteres.";
  if (!PHONE_REGEX.test(s.telefono.trim()))
    return "Teléfono debe ser exactamente 10 dígitos (sin espacios ni guiones).";
  const tg = s.telegram_username.trim();
  if (tg && !TG_USERNAME_REGEX.test(tg))
    return "Usuario de Telegram inválido (3-32 chars, letras/números/guion bajo).";
  return null;
}

/* ------------------------------------------------------------------ */
/* Form state — vendedor individual                                     */
/* ------------------------------------------------------------------ */
interface VendedorState {
  email: string;
  nombre_completo: string;
  rfc_personal: string;
  telefono: string;
  telegram_username: string;
}

const INITIAL_VEND: VendedorState = {
  email: "",
  nombre_completo: "",
  rfc_personal: "",
  telefono: "",
  telegram_username: "",
};

function validateVendedor(s: VendedorState): string | null {
  if (!EMAIL_REGEX.test(s.email.trim().toLowerCase()))
    return "Email no parece válido. Revisa el formato (ej: tu@correo.com).";
  const nombre = s.nombre_completo.trim();
  if (nombre.length < 2 || nombre.length > 80)
    return "Nombre completo debe tener entre 2 y 80 caracteres.";
  if (!RFC_PF_REGEX.test(s.rfc_personal.trim().toUpperCase()))
    return "RFC personal inválido. Debe ser RFC de persona física (13 caracteres, mayúsculas).";
  if (!PHONE_REGEX.test(s.telefono.trim()))
    return "Teléfono debe ser exactamente 10 dígitos (sin espacios ni guiones).";
  const tg = s.telegram_username.trim();
  if (tg && !TG_USERNAME_REGEX.test(tg))
    return "Usuario de Telegram inválido (3-32 chars, letras/números/guion bajo).";
  return null;
}

/* ------------------------------------------------------------------ */
/* Framer variants                                                      */
/* ------------------------------------------------------------------ */
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ------------------------------------------------------------------ */
/* Inner page — reads searchParams                                      */
/* ------------------------------------------------------------------ */
function SignupPageInner() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "";
  const isVendedor = plan === "vendedor_telcel";

  /* --- estado distribuidor --- */
  const [dist, setDist] = useState<DistribuidorState>(INITIAL_DIST);
  /* --- estado vendedor --- */
  const [vend, setVend] = useState<VendedorState>(INITIAL_VEND);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const errorId = useId();
  const termsId = useId();

  function updateDist<K extends keyof DistribuidorState>(key: K, value: string) {
    setDist((s) => ({ ...s, [key]: value }));
  }
  function updateVend<K extends keyof VendedorState>(key: K, value: string) {
    setVend((s) => ({ ...s, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError("Debes aceptar los términos de servicio antes de enviar la solicitud.");
      return;
    }

    if (isVendedor) {
      const err = validateVendedor(vend);
      if (err) { setError(err); return; }
    } else {
      const err = validateDistribuidor(dist);
      if (err) { setError(err); return; }
    }

    setSubmitting(true);
    try {
      const payload = isVendedor
        ? {
            tenant_type: "individual",
            email: vend.email.trim().toLowerCase(),
            nombre_completo: vend.nombre_completo.trim(),
            rfc_empresa: vend.rfc_personal.trim().toUpperCase(),
            nombre_distribuidor: vend.nombre_completo.trim(),
            telefono: vend.telefono.trim(),
            telegram_username: vend.telegram_username.trim().replace(/^@/, ""),
          }
        : {
            tenant_type: "distribuidor",
            email: dist.email.trim().toLowerCase(),
            rfc_empresa: dist.rfc_empresa.trim().toUpperCase(),
            nombre_distribuidor: dist.nombre_distribuidor.trim(),
            telefono: dist.telefono.trim(),
            telegram_username: dist.telegram_username.trim().replace(/^@/, ""),
          };

      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "No se pudo enviar la solicitud. Intenta más tarde.");
        return;
      }
      setDone(true);
    } catch {
      setError("Error de red. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-indigo-50 via-cyan-50 to-pink-50 text-slate-900 antialiased overflow-hidden relative">
        <FloatingBlobs />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-lg w-full bg-white/85 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl shadow-indigo-200/50 p-8 sm:p-10 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 14 }}
            className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 mb-5 shadow-[0_10px_30px_rgba(45,212,191,0.4)]"
          >
            <CheckCircleIcon className="w-8 h-8 text-white" aria-hidden />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
            ¡Cuenta creada!
          </h1>
          <div className="text-slate-600 leading-relaxed mb-6 font-medium space-y-3">
            <p>
              Tu cuenta está lista. Tienes <strong>14 días gratis</strong> para probar el cotizador.
            </p>
            <p className="text-indigo-700 font-bold">
              Tu prueba termina el{" "}
              <TrialEndDate />
            </p>
            <p className="text-sm text-slate-500">
              {isVendedor
                ? "Al terminar el periodo de prueba, se cobrará según tu plan de vendedor individual. Puedes cancelar cuando quieras desde el panel de configuración."
                : "Al terminar el periodo de prueba, se cobrará según el plan que seleccionaste. Puedes cancelar cuando quieras desde el panel de configuración."}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white font-bold shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_12px_34px_rgba(79,70,229,0.4)] transition-all"
          >
            Volver al inicio
            <ArrowRightIcon className="w-4 h-4" aria-hidden />
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white text-slate-900 antialiased overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      {/* LEFT pane: formulario (bg-white) */}
      <section className="relative flex flex-col px-6 py-10 sm:px-10 lg:px-16 lg:py-12 bg-white z-10 overflow-y-auto">
        <div className="relative z-10 mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowRightIcon className="w-4 h-4 rotate-180 mr-1.5" aria-hidden />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-slate-900">
              Cotizador
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(45,212,191,0.25)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Beta
            </span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex items-center">
          <motion.div
            className="w-full max-w-md mx-auto"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {isVendedor ? (
              /* ---- HEADING vendedor individual ---- */
              <>
                <motion.h1
                  variants={itemVariants}
                  className="text-4xl md:text-4xl font-extrabold tracking-tight text-slate-900"
                >
                  Soy vendedor Telcel individual
                </motion.h1>
                <motion.p
                  variants={itemVariants}
                  className="text-slate-600 mt-3 leading-relaxed font-medium"
                >
                  Cuenta personal para vendedores independientes. Validamos cada solicitud a mano y respondemos en menos de 24h hábiles.
                </motion.p>
              </>
            ) : (
              /* ---- HEADING distribuidor ---- */
              <>
                <motion.h1
                  variants={itemVariants}
                  className="text-4xl md:text-4xl font-extrabold tracking-tight text-slate-900"
                >
                  Soy distribuidor Telcel
                </motion.h1>
                <motion.p
                  variants={itemVariants}
                  className="text-slate-600 mt-3 leading-relaxed font-medium"
                >
                  Distribuidor autorizado Telcel. Validamos cada cuenta a mano y respondemos en menos de 24h hábiles.
                </motion.p>
              </>
            )}

            <motion.form
              variants={containerVariants}
              onSubmit={onSubmit}
              className="space-y-4 mt-8"
              noValidate
              aria-describedby={error ? errorId : undefined}
            >
              {isVendedor ? (
                /* ---- CAMPOS vendedor individual ---- */
                <>
                  <Field
                    label="Correo electrónico"
                    type="email"
                    autoComplete="email"
                    value={vend.email}
                    onChange={(v) => updateVend("email", v)}
                    placeholder="tu@correo.com"
                    required
                    hasError={!!error}
                    errorId={errorId}
                  />
                  <Field
                    label="Nombre completo"
                    autoComplete="name"
                    value={vend.nombre_completo}
                    onChange={(v) => updateVend("nombre_completo", v)}
                    placeholder="Juan Pérez López"
                    maxLength={80}
                    required
                    hasError={!!error}
                    errorId={errorId}
                  />
                  <Field
                    label="RFC personal"
                    value={vend.rfc_personal}
                    onChange={(v) => updateVend("rfc_personal", v.toUpperCase())}
                    placeholder="PELJ831214ABC"
                    maxLength={13}
                    required
                    hint="RFC de persona física con homoclave (13 caracteres)."
                    hasError={!!error}
                    errorId={errorId}
                  />
                  <Field
                    label="Teléfono"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={vend.telefono}
                    onChange={(v) => updateVend("telefono", v.replace(/\D/g, ""))}
                    placeholder="5512345678"
                    maxLength={10}
                    required
                    hint="10 dígitos sin espacios ni guiones."
                    hasError={!!error}
                    errorId={errorId}
                  />
                  <Field
                    label="Usuario de Telegram (opcional)"
                    value={vend.telegram_username}
                    onChange={(v) => updateVend("telegram_username", v)}
                    placeholder="@tuusuario"
                    hint="Si lo das, te avisamos por Telegram cuando aprobemos."
                    hasError={!!error}
                    errorId={errorId}
                  />
                </>
              ) : (
                /* ---- CAMPOS distribuidor ---- */
                <>
                  <Field
                    label="Email de contacto"
                    type="email"
                    autoComplete="email"
                    value={dist.email}
                    onChange={(v) => updateDist("email", v)}
                    placeholder="tu@empresa.com"
                    required
                    hasError={!!error}
                    errorId={errorId}
                  />
                  <Field
                    label="RFC de la empresa"
                    value={dist.rfc_empresa}
                    onChange={(v) => updateDist("rfc_empresa", v.toUpperCase())}
                    placeholder="ABC123456XY7"
                    maxLength={13}
                    required
                    hint="RFC con homoclave (12 o 13 caracteres)."
                    hasError={!!error}
                    errorId={errorId}
                  />
                  <Field
                    label="Nombre del distribuidor"
                    value={dist.nombre_distribuidor}
                    onChange={(v) => updateDist("nombre_distribuidor", v)}
                    placeholder="Distribuidores Huvasi SA de CV"
                    maxLength={80}
                    required
                    hasError={!!error}
                    errorId={errorId}
                  />
                  <Field
                    label="Teléfono"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={dist.telefono}
                    onChange={(v) => updateDist("telefono", v.replace(/\D/g, ""))}
                    placeholder="5512345678"
                    maxLength={10}
                    required
                    hint="10 dígitos sin espacios ni guiones."
                    hasError={!!error}
                    errorId={errorId}
                  />
                  <Field
                    label="Usuario de Telegram (opcional)"
                    value={dist.telegram_username}
                    onChange={(v) => updateDist("telegram_username", v)}
                    placeholder="@tuusuario"
                    hint="Si lo das, te avisamos por Telegram cuando aprobemos."
                    hasError={!!error}
                    errorId={errorId}
                  />
                </>
              )}

              <motion.div variants={itemVariants} className="flex items-start gap-3 pt-1">
                <input
                  id={termsId}
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 bg-slate-50 text-indigo-600 focus:ring-4 focus:ring-indigo-100/50 focus:ring-offset-0"
                  aria-describedby={error ? errorId : undefined}
                />
                <label
                  htmlFor={termsId}
                  className="text-sm text-slate-700 leading-relaxed"
                >
                  Acepto los{" "}
                  <Link
                    href="/terminos"
                    className="text-cyan-700 font-semibold hover:underline"
                  >
                    términos de servicio
                  </Link>{" "}
                  y autorizo el tratamiento de datos para validar mi cuenta.
                </label>
              </motion.div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    key="error"
                    id={errorId}
                    role="alert"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div variants={itemVariants}>
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: submitting ? 1 : 1.02 }}
                  whileTap={{ scale: submitting ? 1 : 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="relative w-full overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white font-bold py-3.5 px-6 shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_12px_34px_rgba(79,70,229,0.4)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                  />
                  <span className="relative inline-flex items-center justify-center gap-2">
                    {submitting ? "Enviando..." : "Enviar solicitud"}
                    {!submitting && (
                      <ArrowRightIcon className="w-4 h-4" aria-hidden />
                    )}
                  </span>
                </motion.button>
              </motion.div>

              <motion.div variants={itemVariants} className="flex items-center" aria-hidden>
                <div className="flex-grow border-t border-slate-200" />
                <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  o registrarte con
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </motion.div>

              <motion.div variants={itemVariants}>
                <Link
                  href="https://t.me/CMdemobot?start=signup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-3 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-6 py-3 font-semibold text-slate-700 transition-all"
                >
                  <svg
                    aria-hidden
                    className="w-5 h-5 text-cyan-500"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                  </svg>
                  <span>Continuar con Telegram</span>
                </Link>
              </motion.div>
            </motion.form>

            <motion.p
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="text-sm text-slate-600 text-center mt-6"
            >
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="text-cyan-700 font-semibold hover:underline"
              >
                Iniciar sesión
              </Link>
              .
            </motion.p>

            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="mt-8 flex flex-wrap gap-2 justify-center"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Datos en México
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Cifrado E2E
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Logs auditables
              </span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* RIGHT pane: visual (oculto en mobile) */}
      <aside
        className="hidden lg:flex relative flex-col justify-center items-center overflow-hidden bg-gradient-to-br from-indigo-50 via-cyan-50 to-pink-50"
        aria-hidden
      >
        {/* Grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.18] mix-blend-multiply pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")",
          }}
        />

        <FloatingBlobs />

        <SignupVisual />

        <div className="absolute bottom-6 right-8 text-xs font-medium text-slate-400 z-10">
          Hecho en México 🇲🇽
        </div>
      </aside>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Default export — Suspense boundary requerido por useSearchParams    */
/* ------------------------------------------------------------------ */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

/* ---------------------------------------------------------------------- */
/* FloatingBlobs — 4 motion.div decorativos en background con rotate+translate */
/* ---------------------------------------------------------------------- */

function FloatingBlobs() {
  return (
    <>
      <motion.div
        className="absolute top-[8%] left-[6%] w-96 h-96 rounded-full blur-3xl bg-indigo-300/40 mix-blend-multiply"
        animate={{
          x: [0, 30, -10, 0],
          y: [0, -20, 15, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-[6%] right-[8%] w-[28rem] h-[28rem] rounded-full blur-3xl bg-cyan-300/40 mix-blend-multiply"
        animate={{
          x: [0, -25, 20, 0],
          y: [0, 25, -15, 0],
          rotate: [360, 180, 0],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-[35%] right-[12%] w-72 h-72 rounded-full blur-3xl bg-pink-300/30 mix-blend-multiply"
        animate={{
          x: [0, 20, -20, 0],
          y: [0, -25, 20, 0],
          rotate: [0, 120, 240, 360],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-[20%] left-[12%] w-80 h-80 rounded-full blur-3xl bg-violet-200/40 mix-blend-multiply"
        animate={{
          x: [0, 25, -15, 0],
          y: [0, 20, -10, 0],
          rotate: [180, 90, 0, 360, 180],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* SignupVisual — Mockup card con folio 2378845 + chips flotantes          */
/* ---------------------------------------------------------------------- */

function SignupVisual() {
  return (
    <div className="relative z-10 w-full max-w-md px-8">
      {/* Floating chip top-left: AB 25% aplicado */}
      <motion.div
        initial={{ opacity: 0, y: -10, x: -20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
        className="absolute -left-8 top-10 z-20"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-3 bg-white/90 backdrop-blur-md rounded-2xl px-3 py-2.5 shadow-xl shadow-cyan-200/40 border border-white/60"
        >
          <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
            <BoltIcon className="w-4 h-4" />
          </span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              A/B mensual
            </div>
            <div className="text-sm font-bold text-slate-900">25% aplicado</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating chip top-right: +18.4% margen */}
      <motion.div
        initial={{ opacity: 0, y: -10, x: 20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ delay: 0.75, duration: 0.6, ease: "easeOut" }}
        className="absolute -right-6 top-2 z-20"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-xl shadow-indigo-200/40 border border-white/60"
        >
          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <ArrowTrendingUpIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Margen
            </div>
            <div className="text-sm font-bold text-slate-900">+18.4%</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Main mockup card: cotización completada — float continuo */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-7 shadow-2xl shadow-indigo-200/50 border border-white/60 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-100/50 to-transparent rounded-bl-full pointer-events-none" />

          <div className="relative flex justify-between items-start mb-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                Cotización completada
              </span>
            </div>
            <div className="text-xs font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-1 rounded-md">
              #2378845
            </div>
          </div>

          <div className="relative mb-5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Cliente
            </div>
            <p className="text-sm text-slate-700 font-medium leading-tight">
              Celumaster ·{" "}
              <span className="font-mono text-slate-900">LUFJ831214AHA</span> ·
              5 líneas
            </p>
          </div>

          <div className="relative mb-6">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Valor total (MXN)
            </div>
            <div className="font-extrabold text-3xl text-slate-900 tracking-tight tabular-nums">
              $80,067
              <span className="text-2xl text-slate-400">.50</span>
            </div>
          </div>

          <div className="relative h-14 w-full rounded-xl bg-gradient-to-r from-cyan-50 to-indigo-50 flex items-end p-2 mb-5">
            <div className="w-full h-8 flex items-end gap-1">
              <div className="w-1/6 bg-cyan-200 rounded-t-sm h-1/4" />
              <div className="w-1/6 bg-cyan-300 rounded-t-sm h-2/4" />
              <div className="w-1/6 bg-cyan-400 rounded-t-sm h-1/3" />
              <div className="w-1/6 bg-indigo-300 rounded-t-sm h-3/4" />
              <div className="w-1/6 bg-indigo-400 rounded-t-sm h-2/3" />
              <div className="w-1/6 bg-indigo-500 rounded-t-sm h-full" />
            </div>
          </div>

          <div className="relative flex gap-2">
            <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 px-3 py-2.5 rounded-full shadow-[0_8px_20px_rgba(79,70,229,0.25)]">
              <DocumentTextIcon className="w-3.5 h-3.5" />
              PDF cliente
            </span>
            <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-2.5 rounded-full">
              <DocumentTextIcon className="w-3.5 h-3.5" />
              PDF interno
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating bottom-right chip */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.6, ease: "easeOut" }}
        className="absolute -right-4 -bottom-8 z-20"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-3 bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-xl shadow-pink-200/40 border border-white/60 max-w-[14rem]"
        >
          <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md">
            <CheckCircleIcon className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              2 min vs 90 min
            </div>
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              en Excel manual
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  hint?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "url";
  hasError?: boolean;
  errorId?: string;
}

function Field(props: FieldProps) {
  const inputId = useId();
  const hintId = useId();
  const describedBy =
    [props.hint ? hintId : null, props.hasError ? props.errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <motion.div variants={itemVariants}>
      <label
        htmlFor={inputId}
        className="block text-xs font-bold tracking-widest text-slate-500 uppercase mb-2 ml-1"
      >
        {props.label}
        {props.required && (
          <span className="text-rose-500 ml-1" aria-hidden>
            *
          </span>
        )}
      </label>
      <input
        id={inputId}
        type={props.type || "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        maxLength={props.maxLength}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        aria-invalid={props.hasError || undefined}
        aria-describedby={describedBy}
        className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium"
      />
      {props.hint && (
        <p id={hintId} className="text-xs text-slate-500 mt-1.5 ml-1">
          {props.hint}
        </p>
      )}
    </motion.div>
  );
}
