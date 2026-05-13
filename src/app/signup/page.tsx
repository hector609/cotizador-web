"use client";

/**
 * /signup — solicitud pública de acceso self-service.
 *
 * Form para que un distribuidor potencial pida acceso. Submit → POST /api/signup
 * → la web app firma con HMAC y proxea a POST /api/v1/signup del bot, que
 * persiste pendiente y manda Telegram al super-admin con botones aprobar/rechazar.
 *
 * Validaciones espejadas con server (defense-in-depth):
 *   email: regex básica.
 *   rfc_empresa: regex RFC mexicano (12 ó 13 chars).
 *   nombre_distribuidor: 2-80 chars.
 *   telefono: 10 dígitos exactos.
 *   telegram_username: opcional, regex Telegram.
 *
 * Tras enviar muestra "Solicitud enviada, te avisamos en 24h" — sin info
 * sensible (ni request_id) para no dar señal a bots de qué requests son válidos.
 */

import Link from "next/link";
import { useId, useState } from "react";
import {
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from "@/components/icons";

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const TG_USERNAME_REGEX = /^@?[A-Za-z0-9_]{3,32}$/;

interface FormState {
  email: string;
  rfc_empresa: string;
  nombre_distribuidor: string;
  telefono: string;
  telegram_username: string;
}

const INITIAL: FormState = {
  email: "",
  rfc_empresa: "",
  nombre_distribuidor: "",
  telefono: "",
  telegram_username: "",
};

function validate(state: FormState): string | null {
  if (!EMAIL_REGEX.test(state.email.trim().toLowerCase())) {
    return "Email no parece válido. Revisa el formato (ej: tu@empresa.com).";
  }
  if (!RFC_REGEX.test(state.rfc_empresa.trim().toUpperCase())) {
    return "RFC inválido. Debe ser RFC mexicano (12 o 13 caracteres, mayúsculas).";
  }
  const nombre = state.nombre_distribuidor.trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return "Nombre del distribuidor debe tener entre 2 y 80 caracteres.";
  }
  if (!PHONE_REGEX.test(state.telefono.trim())) {
    return "Teléfono debe ser exactamente 10 dígitos (sin espacios ni guiones).";
  }
  const tg = state.telegram_username.trim();
  if (tg && !TG_USERNAME_REGEX.test(tg)) {
    return "Usuario de Telegram inválido (3-32 chars, letras/números/guion bajo).";
  }
  return null;
}

export default function SignupPage() {
  const [state, setState] = useState<FormState>(INITIAL);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const errorId = useId();
  const termsId = useId();

  function update<K extends keyof FormState>(key: K, value: string) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError(
        "Debes aceptar los términos de servicio antes de enviar la solicitud.",
      );
      return;
    }

    const err = validate(state);
    if (err) {
      setError(err);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.email.trim().toLowerCase(),
          rfc_empresa: state.rfc_empresa.trim().toUpperCase(),
          nombre_distribuidor: state.nombre_distribuidor.trim(),
          telefono: state.telefono.trim(),
          telegram_username: state.telegram_username.trim().replace(/^@/, ""),
        }),
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
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0b1326] text-white/90 antialiased overflow-hidden"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 0%, rgba(29, 78, 216, 0.18) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(45, 212, 191, 0.12) 0%, transparent 45%),
            radial-gradient(circle at 15% 70%, rgba(6, 182, 212, 0.10) 0%, transparent 40%)
          `,
        }}
      >
        <div className="max-w-lg w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.15)] p-8 sm:p-10 text-center">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 mb-5 shadow-[0_0_30px_rgba(45,212,191,0.4)]">
            <CheckCircleIcon className="w-7 h-7 text-[#0b1326]" aria-hidden />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            Solicitud enviada
          </h1>
          <p className="text-slate-400 leading-relaxed mb-6">
            Recibimos tu solicitud. Validamos cada cuenta a mano para evitar
            abusos del portal Telcel — te avisamos en menos de 24h hábiles por
            correo y/o Telegram con tus credenciales de acceso.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:scale-[0.98] transition"
          >
            Volver al inicio
            <ArrowRightIcon className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </main>
    );
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
              Crear cuenta
            </h1>
            <p className="text-slate-400 mt-3 leading-relaxed">
              Distribuidor autorizado Telcel. Validamos cada cuenta a mano y
              respondemos en menos de 24h hábiles.
            </p>

            <form
              onSubmit={onSubmit}
              className="space-y-5 mt-8"
              noValidate
              aria-describedby={error ? errorId : undefined}
            >
              <Field
                label="Email de contacto"
                type="email"
                autoComplete="email"
                value={state.email}
                onChange={(v) => update("email", v)}
                placeholder="tu@empresa.com"
                required
                hasError={!!error}
                errorId={errorId}
              />
              <Field
                label="RFC de la empresa"
                value={state.rfc_empresa}
                onChange={(v) => update("rfc_empresa", v.toUpperCase())}
                placeholder="ABC123456XY7"
                maxLength={13}
                required
                hint="RFC con homoclave (12 o 13 caracteres)."
                hasError={!!error}
                errorId={errorId}
              />
              <Field
                label="Nombre del distribuidor"
                value={state.nombre_distribuidor}
                onChange={(v) => update("nombre_distribuidor", v)}
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
                value={state.telefono}
                onChange={(v) => update("telefono", v.replace(/\D/g, ""))}
                placeholder="5512345678"
                maxLength={10}
                required
                hint="10 dígitos sin espacios ni guiones."
                hasError={!!error}
                errorId={errorId}
              />
              <Field
                label="Usuario de Telegram (opcional)"
                value={state.telegram_username}
                onChange={(v) => update("telegram_username", v)}
                placeholder="@tuusuario"
                hint="Si lo das, te avisamos por Telegram cuando aprobemos."
                hasError={!!error}
                errorId={errorId}
              />

              <div className="flex items-start gap-3 pt-1">
                <input
                  id={termsId}
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-2 focus:ring-cyan-400/30 focus:ring-offset-0"
                  aria-describedby={error ? errorId : undefined}
                />
                <label
                  htmlFor={termsId}
                  className="text-sm text-slate-300 leading-relaxed"
                >
                  Acepto los{" "}
                  <Link
                    href="/terminos"
                    className="text-cyan-300 font-semibold hover:underline"
                  >
                    términos de servicio
                  </Link>{" "}
                  y autorizo el tratamiento de datos para validar mi cuenta.
                </label>
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
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {submitting ? "Enviando..." : "Enviar solicitud"}
                {!submitting && (
                  <ArrowRightIcon className="w-4 h-4" aria-hidden />
                )}
              </button>
            </form>

            <p className="text-sm text-slate-400 text-center mt-6">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="text-cyan-300 font-semibold hover:underline"
              >
                Iniciar sesión
              </Link>
              .
            </p>
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
        <SignupVisual />
        <div className="relative z-10 mt-auto pt-10 text-xs text-slate-500">
          Hecho en MX 🇲🇽
        </div>
      </aside>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* SignupVisual — slice del producto con folio 2378845 + palancas          */
/* Simplificación del ChatMockup de la landing (no exportado).             */
/* ---------------------------------------------------------------------- */

function SignupVisual() {
  return (
    <div className="relative z-10 max-w-md mx-auto w-full">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-300">
          Distribuidores Telcel
        </p>
        <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          Cotiza en menos de{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300">
            un minuto.
          </span>
        </h2>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          La misma cotización que tomas 15 minutos en el portal —
          automatizada, con historial por cliente y PDF interno + cliente.
        </p>
      </div>

      {/* Floating folio badge */}
      <div className="absolute right-0 -top-2 z-20 flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 shadow-[0_0_30px_rgba(6,182,212,0.2)] rotate-3">
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

      {/* Floating palancas card */}
      <div className="absolute -right-6 -bottom-6 z-20 w-52 bg-white/5 backdrop-blur-md border border-cyan-300/20 rounded-2xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] -rotate-3">
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
    <div>
      <label
        htmlFor={inputId}
        className="block text-xs font-medium tracking-widest text-slate-500 uppercase mb-2"
      >
        {props.label}
        {props.required && (
          <span className="text-red-400 ml-1" aria-hidden>
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
        className="block w-full bg-white/5 backdrop-blur border border-white/10 rounded-lg px-4 py-3 text-white/90 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition"
      />
      {props.hint && (
        <p id={hintId} className="text-xs text-slate-500 mt-1.5">
          {props.hint}
        </p>
      )}
    </div>
  );
}
