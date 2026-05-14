"use client";

/**
 * Step2Contacto — Datos de contacto del distribuidor.
 * Campos: email admin, teléfono, sitio web (opcional).
 */

import { useId } from "react";
import type { OnboardingData } from "@/lib/onboardingApi";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;

interface Props {
  data: Partial<OnboardingData>;
  onChange: (patch: Partial<OnboardingData>) => void;
  errors: Partial<Record<keyof OnboardingData, string>>;
}

export function Step2Contacto({ data, onChange, errors }: Props) {
  const uid = useId();

  return (
    <div className="space-y-5">
      <Field
        id={`${uid}-email`}
        label="Email administrativo"
        type="email"
        hint="Para notificaciones del sistema, activación y soporte."
        value={data.email ?? ""}
        onChange={(v) => onChange({ email: v.trim() })}
        error={errors.email}
        placeholder="admin@tuempresa.mx"
        inputMode="email"
      />
      <Field
        id={`${uid}-telefono`}
        label="Teléfono"
        type="tel"
        hint="Con lada. Ej. +52 55 1234 5678"
        value={data.telefono ?? ""}
        onChange={(v) => onChange({ telefono: v })}
        error={errors.telefono}
        placeholder="+52 55 1234 5678"
        inputMode="tel"
      />
      <Field
        id={`${uid}-web`}
        label="Sitio web"
        type="url"
        hint="Opcional. Se incluye en el footer de los PDFs."
        value={data.sitio_web ?? ""}
        onChange={(v) => onChange({ sitio_web: v })}
        error={errors.sitio_web}
        placeholder="https://tuempresa.mx"
        inputMode="url"
        optional
      />
    </div>
  );
}

export function validateStep2(data: Partial<OnboardingData>): Partial<Record<keyof OnboardingData, string>> {
  const errors: Partial<Record<keyof OnboardingData, string>> = {};
  if (!data.email?.trim()) {
    errors.email = "El email es obligatorio.";
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = "Email inválido.";
  }
  if (!data.telefono?.trim()) {
    errors.telefono = "El teléfono es obligatorio.";
  } else if (!PHONE_REGEX.test(data.telefono.trim())) {
    errors.telefono = "Teléfono inválido. Incluye la lada, ej. +52 55 1234 5678.";
  }
  if (data.sitio_web?.trim()) {
    try {
      new URL(data.sitio_web.trim());
    } catch {
      errors.sitio_web = "URL inválida. Debe comenzar con https://";
    }
  }
  return errors;
}

/* ─── Field helper ─── */
interface FieldProps {
  id: string;
  label: string;
  type?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  optional?: boolean;
}

function Field({ id, label, type = "text", hint, value, onChange, error, placeholder, inputMode, optional }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800 mb-1">
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-slate-400">(opcional)</span>}
      </label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={[
          "block w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400",
          "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition",
          error ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-white hover:border-slate-400",
        ].join(" ")}
      />
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
