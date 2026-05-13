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
  CheckCircleIcon,
  LockClosedIcon,
  MapPinIcon,
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
      <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center">
          <div className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-blue-100 mb-5">
            <CheckCircleIcon className="w-6 h-6 text-blue-700" aria-hidden />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-3">
            Solicitud enviada
          </h1>
          <p className="text-slate-600 leading-relaxed mb-6">
            Recibimos tu solicitud. Validamos cada cuenta a mano para evitar
            abusos del portal Telcel — te avisamos en menos de 24h hábiles
            por correo y/o Telegram con tus credenciales de acceso.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-blue-700 bg-white border-2 border-blue-700 rounded-lg hover:bg-blue-50 transition"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
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
              Pide tu acceso.
            </h1>
            <p className="text-slate-600 mt-3 leading-relaxed">
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
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-2 focus:ring-blue-700/20"
                  aria-describedby={error ? errorId : undefined}
                />
                <label
                  htmlFor={termsId}
                  className="text-sm text-slate-700 leading-relaxed"
                >
                  Acepto los{" "}
                  <Link
                    href="/terminos"
                    className="text-blue-700 font-semibold hover:underline"
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
                  className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg py-2.5 transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Enviando..." : "Enviar solicitud"}
                {!submitting && (
                  <ArrowRightIcon className="w-4 h-4" aria-hidden />
                )}
              </button>
            </form>

            <p className="text-xs text-slate-500 text-center mt-6">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="text-blue-700 font-semibold hover:underline"
              >
                Entrar al dashboard
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Columna derecha: por qué confiar + trust signals */}
      <aside className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-12 py-14 border-l border-slate-200">
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Distribuidores Telcel
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-3">
            Cotiza en menos de un minuto.
          </h2>
          <p className="text-slate-600 mt-3 leading-relaxed">
            La misma cotización que tomas 15 minutos en el portal — automatizada,
            con historial por cliente y descarga directa de PDF interno + cliente.
          </p>

          <ul className="mt-8 space-y-4">
            <li className="flex items-start gap-3">
              <CheckCircleIcon
                className="w-5 h-5 text-blue-700 mt-0.5 shrink-0"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Validación manual de cada alta
                </p>
                <p className="text-xs text-slate-500">
                  Confirmamos RFC contra el padrón Telcel para evitar abuso del
                  portal.
                </p>
              </div>
            </li>
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
                  Tu cartera fiscal y la de tus clientes nunca sale del país.
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
                  Cifrado y aislado por tenant
                </p>
                <p className="text-xs text-slate-500">
                  TLS 1.3 en tránsito y separación lógica por distribuidor.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </aside>
    </main>
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
        className="block text-sm font-medium text-slate-700 mb-1.5"
      >
        {props.label}
        {props.required && (
          <span className="text-red-600 ml-0.5" aria-hidden>
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
        className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 transition"
      />
      {props.hint && (
        <p id={hintId} className="text-xs text-slate-500 mt-1.5">
          {props.hint}
        </p>
      )}
    </div>
  );
}
