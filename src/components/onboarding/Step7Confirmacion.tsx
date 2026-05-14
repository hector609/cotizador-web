"use client";

/**
 * Step7Confirmacion — Resumen final + aceptar términos.
 * Muestra un resumen de los datos ingresados en los 6 pasos previos.
 */

import { useId } from "react";
import { CheckCircle2, Building2, Phone, Palette, Key, Users, Briefcase } from "lucide-react";
import type { OnboardingData } from "@/lib/onboardingApi";

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

interface Props {
  data: Partial<OnboardingData>;
  onChange: (patch: Partial<OnboardingData>) => void;
  errors: Partial<Record<keyof OnboardingData, string>>;
}

export function Step7Confirmacion({ data, onChange, errors }: Props) {
  const uid = useId();

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Revisa que todo esté correcto antes de activar tu cuenta. Podrás actualizar estos datos después desde el panel de configuración.
      </p>

      {/* Summary sections */}
      <div className="space-y-3">
        <SummarySection
          icon={<Building2 className="w-4 h-4 text-indigo-600" />}
          title="Distribuidor"
          step={1}
          items={[
            { label: "Nombre", value: data.nombre },
            { label: "Razón social", value: data.razon_social },
            { label: "RFC", value: data.rfc },
          ]}
        />
        <SummarySection
          icon={<Phone className="w-4 h-4 text-indigo-600" />}
          title="Contacto"
          step={2}
          items={[
            { label: "Email", value: data.email },
            { label: "Teléfono", value: data.telefono },
            { label: "Sitio web", value: data.sitio_web || "—" },
          ]}
        />
        <SummarySection
          icon={<Palette className="w-4 h-4 text-indigo-600" />}
          title="Branding"
          step={3}
          items={[
            {
              label: "Color primario",
              value: data.color_primario,
              swatch: HEX_REGEX.test(data.color_primario ?? "") ? data.color_primario : undefined,
            },
            {
              label: "Color acento",
              value: data.color_acento,
              swatch: HEX_REGEX.test(data.color_acento ?? "") ? data.color_acento : undefined,
            },
            { label: "Logo", value: data.logo_url || "—" },
          ]}
        />
        <SummarySection
          icon={<Key className="w-4 h-4 text-indigo-600" />}
          title="Credenciales Telcel"
          step={4}
          items={[
            { label: "Usuario", value: data.telcel_usuario },
            { label: "Password", value: "••••••••  (guardado)" },
          ]}
        />
        <SummarySection
          icon={<Briefcase className="w-4 h-4 text-indigo-600" />}
          title="Cartera inicial"
          step={5}
          items={[
            {
              label: "Clientes",
              value: data.skip_cartera
                ? "Omitido"
                : data.clientes?.length
                ? `${data.clientes.length} cliente${data.clientes.length !== 1 ? "s" : ""}`
                : "Sin clientes (se agregarán después)",
            },
          ]}
        />
        <SummarySection
          icon={<Users className="w-4 h-4 text-indigo-600" />}
          title="Equipo"
          step={6}
          items={[
            {
              label: "Vendedores",
              value: data.skip_vendedores
                ? "Omitido"
                : data.vendedores?.length
                ? `${data.vendedores.length} vendedor${data.vendedores.length !== 1 ? "es" : ""}`
                : "Sin vendedores (se agregarán después)",
            },
          ]}
        />
      </div>

      {/* Terms checkbox */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label
          htmlFor={`${uid}-terminos`}
          className="flex items-start gap-3 cursor-pointer group"
        >
          <div className="relative mt-0.5 shrink-0">
            <input
              id={`${uid}-terminos`}
              type="checkbox"
              checked={data.aceptar_terminos ?? false}
              onChange={(e) => onChange({ aceptar_terminos: e.target.checked })}
              aria-describedby={errors.aceptar_terminos ? `${uid}-terminos-err` : undefined}
              className="sr-only"
            />
            <div
              className={[
                "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                data.aceptar_terminos
                  ? "bg-indigo-600 border-indigo-600"
                  : "bg-white border-slate-300 group-hover:border-indigo-400",
              ].join(" ")}
              aria-hidden="true"
            >
              {data.aceptar_terminos && (
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              )}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-800">
              Acepto los{" "}
              <a
                href="/terminos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Términos de servicio
              </a>{" "}
              y la{" "}
              <a
                href="/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Política de privacidad
              </a>
              .
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Al activar tu cuenta confirmas que los datos son correctos y que eres un representante autorizado del distribuidor.
            </p>
          </div>
        </label>
        {errors.aceptar_terminos && (
          <p id={`${uid}-terminos-err`} role="alert" className="mt-2 text-xs font-medium text-rose-600">
            {errors.aceptar_terminos}
          </p>
        )}
      </div>
    </div>
  );
}

export function validateStep7(data: Partial<OnboardingData>): Partial<Record<keyof OnboardingData, string>> {
  const errors: Partial<Record<keyof OnboardingData, string>> = {};
  if (!data.aceptar_terminos) {
    errors.aceptar_terminos = "Debes aceptar los términos para continuar.";
  }
  return errors;
}

/* ─── Summary Section ─── */
interface SummaryItem {
  label: string;
  value?: string;
  swatch?: string;
}

function SummarySection({
  icon,
  title,
  step,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  step: number;
  items: SummaryItem[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-slate-800">{title}</span>
        </div>
        <a
          href={`/onboarding/${step}`}
          className="text-xs text-indigo-600 hover:underline font-medium"
        >
          Editar
        </a>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between px-4 py-2 bg-white">
            <span className="text-xs text-slate-500">{item.label}</span>
            <div className="flex items-center gap-2">
              {item.swatch && (
                <div
                  className="w-4 h-4 rounded-md border border-slate-200"
                  style={{ background: item.swatch }}
                  aria-hidden="true"
                />
              )}
              <span className="text-sm font-medium text-slate-800 text-right max-w-[200px] truncate">
                {item.value || <span className="text-slate-400 italic text-xs">Sin completar</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
