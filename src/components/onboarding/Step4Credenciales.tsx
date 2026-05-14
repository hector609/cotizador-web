"use client";

/**
 * Step4Credenciales — Usuario del portal Telcel.
 *
 * Solo se captura el USUARIO (email). El password se envía por separado
 * a /api/tenant/credentials para que nunca pase por /onboarding/step.
 * Esto está documentado en ONBOARDING-API.md.
 */

import { useId, useState } from "react";
import type { OnboardingData } from "@/lib/onboardingApi";
import { Info, Eye, EyeOff, CheckCircle2 } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  data: Partial<OnboardingData>;
  onChange: (patch: Partial<OnboardingData>) => void;
  errors: Partial<Record<keyof OnboardingData, string>>;
}

export function Step4Credenciales({ data, onChange, errors }: Props) {
  const uid = useId();
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdStatus, setPwdStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pwdError, setPwdError] = useState<string | null>(null);

  async function handleSaveCredentials() {
    if (!data.telcel_usuario?.trim() || !EMAIL_REGEX.test(data.telcel_usuario.trim())) {
      setPwdError("Guarda primero el usuario (email válido).");
      return;
    }
    if (password.length < 4) {
      setPwdError("El password debe tener al menos 4 caracteres.");
      return;
    }
    setPwdError(null);
    setPwdStatus("saving");
    try {
      const res = await fetch("/api/tenant/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: data.telcel_usuario.trim(), password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al guardar");
      }
      setPwdStatus("saved");
      setPassword(""); // limpiar de memoria
    } catch (e) {
      setPwdStatus("error");
      setPwdError(e instanceof Error ? e.message : "Error al guardar el password.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="flex gap-3 items-start p-4 rounded-xl bg-indigo-50 border border-indigo-100">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-700">
          Tu usuario de Telcel es el email con el que accedes al{" "}
          <strong>portal de distribuidores Telcel</strong>. El password se cifra con clave maestra y
          nunca se almacena en texto plano.
        </p>
      </div>

      {/* Usuario Telcel */}
      <div>
        <label htmlFor={`${uid}-usuario`} className="block text-sm font-semibold text-slate-800 mb-1">
          Usuario del portal Telcel (email)
        </label>
        <p className="text-xs text-slate-500 mb-1.5">
          Es el email con el que ingresas a portal.telcel.com.
        </p>
        <input
          id={`${uid}-usuario`}
          type="email"
          value={data.telcel_usuario ?? ""}
          onChange={(e) => onChange({ telcel_usuario: e.target.value.trim() })}
          placeholder="tu@correo.telcel.com"
          inputMode="email"
          aria-invalid={!!errors.telcel_usuario}
          aria-describedby={errors.telcel_usuario ? `${uid}-usuario-err` : undefined}
          className={[
            "block w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition",
            errors.telcel_usuario ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-white hover:border-slate-400",
          ].join(" ")}
        />
        {errors.telcel_usuario && (
          <p id={`${uid}-usuario-err`} role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
            {errors.telcel_usuario}
          </p>
        )}
      </div>

      {/* Password — enviado por separado */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-800">Password de Telcel</p>
        <p className="text-xs text-slate-500">
          Se envía directamente al sistema de cifrado. No queda guardado en este formulario.
        </p>
        <div className="relative">
          <input
            id={`${uid}-password`}
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPwdStatus("idle"); }}
            placeholder="Tu password de Telcel"
            aria-label="Password del portal Telcel"
            className={[
              "block w-full rounded-xl border px-3.5 py-2.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400",
              "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition",
              pwdError ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-white hover:border-slate-400",
            ].join(" ")}
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? "Ocultar password" : "Mostrar password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {pwdError && (
          <p role="alert" className="text-xs font-medium text-rose-600">{pwdError}</p>
        )}
        {pwdStatus === "saved" && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Password guardado de forma segura.
          </div>
        )}
        <button
          type="button"
          onClick={handleSaveCredentials}
          disabled={pwdStatus === "saving" || !password}
          className={[
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white transition",
            "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {pwdStatus === "saving" && (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
          )}
          {pwdStatus === "saving" ? "Guardando…" : "Guardar password cifrado"}
        </button>
      </div>
    </div>
  );
}

export function validateStep4(data: Partial<OnboardingData>): Partial<Record<keyof OnboardingData, string>> {
  const errors: Partial<Record<keyof OnboardingData, string>> = {};
  if (!data.telcel_usuario?.trim()) {
    errors.telcel_usuario = "El usuario de Telcel es obligatorio.";
  } else if (!EMAIL_REGEX.test(data.telcel_usuario.trim())) {
    errors.telcel_usuario = "El usuario debe ser un email válido.";
  }
  return errors;
}
