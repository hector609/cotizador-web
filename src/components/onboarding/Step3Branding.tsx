"use client";

/**
 * Step3Branding — Branding del distribuidor.
 * Campos: color primario, color acento, logo URL (con preview inline).
 */

import { useId, useState } from "react";
import type { OnboardingData } from "@/lib/onboardingApi";

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

interface Props {
  data: Partial<OnboardingData>;
  onChange: (patch: Partial<OnboardingData>) => void;
  errors: Partial<Record<keyof OnboardingData, string>>;
}

export function Step3Branding({ data, onChange, errors }: Props) {
  const uid = useId();

  return (
    <div className="space-y-6">
      {/* Color primario */}
      <ColorField
        id={`${uid}-primario`}
        label="Color primario"
        hint="Se usa en encabezados y botones del PDF."
        value={data.color_primario ?? "#4F46E5"}
        onChange={(v) => onChange({ color_primario: v })}
        error={errors.color_primario}
      />

      {/* Color acento */}
      <ColorField
        id={`${uid}-acento`}
        label="Color de acento"
        hint="Se usa en tablas y separadores del PDF."
        value={data.color_acento ?? "#06B6D4"}
        onChange={(v) => onChange({ color_acento: v })}
        error={errors.color_acento}
      />

      {/* Logo URL */}
      <LogoField
        id={`${uid}-logo`}
        value={data.logo_url ?? ""}
        onChange={(v) => onChange({ logo_url: v })}
        error={errors.logo_url}
      />

      {/* Preview de la paleta */}
      <BrandingPreview
        colorPrimario={data.color_primario ?? "#4F46E5"}
        colorAcento={data.color_acento ?? "#06B6D4"}
        logoUrl={data.logo_url}
        nombre={data.nombre ?? "Tu distribuidor"}
      />
    </div>
  );
}

export function validateStep3(data: Partial<OnboardingData>): Partial<Record<keyof OnboardingData, string>> {
  const errors: Partial<Record<keyof OnboardingData, string>> = {};
  if (data.color_primario && !HEX_REGEX.test(data.color_primario)) {
    errors.color_primario = "Color inválido. Debe ser un código hex, ej. #4F46E5.";
  }
  if (data.color_acento && !HEX_REGEX.test(data.color_acento)) {
    errors.color_acento = "Color inválido. Debe ser un código hex, ej. #06B6D4.";
  }
  if (data.logo_url?.trim()) {
    try {
      new URL(data.logo_url.trim());
    } catch {
      errors.logo_url = "URL de logo inválida. Debe comenzar con https://";
    }
  }
  return errors;
}

/* ─── Color Field ─── */
function ColorField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const safeColor = HEX_REGEX.test(value) ? value : "#4F46E5";

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800 mb-1">
        {label}
      </label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <div className="flex items-center gap-3">
        {/* Color picker nativo */}
        <div className="relative">
          <input
            id={`${id}-picker`}
            type="color"
            value={safeColor}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Selector de color para ${label}`}
            className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 p-0.5 bg-white"
          />
        </div>
        {/* Hex input */}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#4F46E5"
          maxLength={7}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={[
            "block w-32 rounded-xl border px-3 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 uppercase",
            "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition",
            error ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-white hover:border-slate-400",
          ].join(" ")}
        />
        {/* Swatch */}
        <div
          className="w-8 h-8 rounded-lg border border-slate-200 shadow-sm"
          style={{ background: safeColor }}
          aria-hidden="true"
        />
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

/* ─── Logo Field ─── */
function LogoField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [imgError, setImgError] = useState(false);

  const isValidUrl = (() => {
    if (!value.trim()) return false;
    try { new URL(value.trim()); return true; } catch { return false; }
  })();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800 mb-1">
        Logo
        <span className="ml-1.5 text-xs font-normal text-slate-400">(opcional)</span>
      </label>
      <p className="text-xs text-slate-500 mb-1.5">
        URL pública de tu logo (PNG/JPG con fondo transparente recomendado, max 500 KB). Se incluye en los PDFs.
      </p>
      <input
        id={id}
        type="url"
        value={value}
        onChange={(e) => { setImgError(false); onChange(e.target.value); }}
        placeholder="https://tuempresa.mx/logo.png"
        inputMode="url"
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
      {/* Preview */}
      {isValidUrl && !imgError && (
        <div className="mt-3 inline-flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview del logo"
            className="max-h-10 max-w-[120px] object-contain"
            onError={() => setImgError(true)}
          />
          <span className="text-xs text-slate-500">Preview</span>
        </div>
      )}
      {isValidUrl && imgError && (
        <p className="mt-2 text-xs text-amber-600">No se pudo cargar la imagen. Verifica que la URL sea pública y accesible.</p>
      )}
    </div>
  );
}

/* ─── Branding preview mini card ─── */
function BrandingPreview({
  colorPrimario,
  colorAcento,
  logoUrl,
  nombre,
}: {
  colorPrimario: string;
  colorAcento: string;
  logoUrl?: string;
  nombre: string;
}) {
  const safePrimary = HEX_REGEX.test(colorPrimario) ? colorPrimario : "#4F46E5";
  const safeAccent = HEX_REGEX.test(colorAcento) ? colorAcento : "#06B6D4";

  return (
    <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div
        className="px-5 py-3 flex items-center gap-3"
        style={{ background: safePrimary }}
        aria-hidden="true"
      >
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-7 object-contain" onError={() => {}} />
        )}
        <span className="text-white font-bold text-sm">{nombre}</span>
      </div>
      <div className="px-5 py-3 flex items-center gap-2 bg-white">
        <div className="h-2 flex-1 rounded-full" style={{ background: safeAccent }} />
        <span className="text-xs text-slate-400">Vista previa de branding</span>
      </div>
    </div>
  );
}
