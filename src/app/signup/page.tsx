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
import { useState } from "react";
import { ArrowRightIcon } from "@/components/icons";

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Solicitud enviada
          </h1>
          <p className="text-slate-600 mb-6">
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
    <main className="min-h-screen px-6 py-10 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← Volver
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Pide tu acceso
          </h1>
          <p className="text-slate-600 mb-8">
            Distribuidor autorizado Telcel. Validamos cada cuenta a mano y
            respondemos en menos de 24h hábiles.
          </p>

          <form onSubmit={onSubmit} className="space-y-5">
            <Field
              label="Email de contacto"
              type="email"
              autoComplete="email"
              value={state.email}
              onChange={(v) => update("email", v)}
              placeholder="tu@empresa.com"
              required
            />
            <Field
              label="RFC de la empresa"
              value={state.rfc_empresa}
              onChange={(v) => update("rfc_empresa", v.toUpperCase())}
              placeholder="ABC123456XY7"
              maxLength={13}
              required
              hint="RFC con homoclave (12 o 13 caracteres)."
            />
            <Field
              label="Nombre del distribuidor"
              value={state.nombre_distribuidor}
              onChange={(v) => update("nombre_distribuidor", v)}
              placeholder="Distribuidores Huvasi SA de CV"
              maxLength={80}
              required
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
            />
            <Field
              label="Usuario de Telegram (opcional)"
              value={state.telegram_username}
              onChange={(v) => update("telegram_username", v)}
              placeholder="@tuusuario"
              hint="Si lo das, te avisamos por Telegram cuando aprobemos."
            />

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Enviando…" : "Enviar solicitud"}
              {!submitting && <ArrowRightIcon className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="underline hover:text-slate-700">
            Entrar al dashboard
          </Link>
          .
        </p>
      </div>
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
}

function Field(props: FieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {props.label}
        {props.required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      <input
        type={props.type || "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        maxLength={props.maxLength}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
      />
      {props.hint && (
        <span className="block text-xs text-slate-500 mt-1">{props.hint}</span>
      )}
    </label>
  );
}
