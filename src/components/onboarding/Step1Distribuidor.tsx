"use client";

/**
 * Step1Distribuidor — Datos del distribuidor.
 * Campos: nombre comercial, razón social, RFC.
 */

import { useId } from "react";
import type { OnboardingData } from "@/lib/onboardingApi";

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

interface Props {
  data: Partial<OnboardingData>;
  onChange: (patch: Partial<OnboardingData>) => void;
  errors: Partial<Record<keyof OnboardingData, string>>;
}

export function Step1Distribuidor({ data, onChange, errors }: Props) {
  const uid = useId();

  return (
    <div className="space-y-5">
      <Field
        id={`${uid}-nombre`}
        label="Nombre comercial"
        hint="El nombre con el que se presenta tu negocio a los clientes."
        value={data.nombre ?? ""}
        onChange={(v) => onChange({ nombre: v })}
        error={errors.nombre}
        placeholder="Ej. CeluMaster"
        maxLength={80}
      />
      <Field
        id={`${uid}-razon`}
        label="Razón social"
        hint="Tal como aparece en tu RFC y facturas."
        value={data.razon_social ?? ""}
        onChange={(v) => onChange({ razon_social: v })}
        error={errors.razon_social}
        placeholder="Ej. CeluMaster SA de CV"
        maxLength={120}
      />
      <Field
        id={`${uid}-rfc`}
        label="RFC"
        hint="12 caracteres (persona moral) o 13 (persona física). Sin guiones."
        value={data.rfc ?? ""}
        onChange={(v) => onChange({ rfc: v.toUpperCase().trim() })}
        error={errors.rfc}
        placeholder="Ej. CMC200101AAA"
        maxLength={13}
        className="uppercase"
      />
    </div>
  );
}

export function validateStep1(data: Partial<OnboardingData>): Partial<Record<keyof OnboardingData, string>> {
  const errors: Partial<Record<keyof OnboardingData, string>> = {};
  if (!data.nombre?.trim()) errors.nombre = "El nombre comercial es obligatorio.";
  else if (data.nombre.trim().length < 2) errors.nombre = "Mínimo 2 caracteres.";

  if (!data.razon_social?.trim()) errors.razon_social = "La razón social es obligatoria.";
  else if (data.razon_social.trim().length < 2) errors.razon_social = "Mínimo 2 caracteres.";

  if (!data.rfc?.trim()) errors.rfc = "El RFC es obligatorio.";
  else if (!RFC_REGEX.test(data.rfc.trim())) errors.rfc = "RFC inválido (12-13 caracteres alfanuméricos).";

  return errors;
}

/* ─── Field helper ─── */
interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

function Field({ id, label, hint, value, onChange, error, placeholder, maxLength, className }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800 mb-1">
        {label}
      </label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={[
          "block w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400",
          "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition",
          error ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-white hover:border-slate-400",
          className ?? "",
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
