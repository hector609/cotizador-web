"use client";

/**
 * Step5Cartera — Cartera inicial de clientes (OPCIONAL).
 * Permite agregar clientes (nombre + RFC) manualmente o saltar.
 */

import { useId, useRef, useState } from "react";
import { Plus, Trash2, Upload, AlertTriangle } from "lucide-react";
import type { OnboardingData } from "@/lib/onboardingApi";

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

interface Cliente {
  nombre: string;
  rfc: string;
}

interface Props {
  data: Partial<OnboardingData>;
  onChange: (patch: Partial<OnboardingData>) => void;
  errors: Partial<Record<keyof OnboardingData, string>>;
}

export function Step5Cartera({ data, onChange, errors }: Props) {
  const uid = useId();
  const clientes: Cliente[] = data.clientes ?? [];
  const [nombre, setNombre] = useState("");
  const [rfc, setRfc] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addCliente() {
    setAddError(null);
    if (!nombre.trim()) { setAddError("El nombre es obligatorio."); return; }
    if (!RFC_REGEX.test(rfc.trim())) { setAddError("RFC inválido (12-13 caracteres alfanuméricos)."); return; }
    const updated = [...clientes, { nombre: nombre.trim(), rfc: rfc.trim().toUpperCase() }];
    onChange({ clientes: updated, skip_cartera: false });
    setNombre("");
    setRfc("");
  }

  function removeCliente(idx: number) {
    const updated = clientes.filter((_, i) => i !== idx);
    onChange({ clientes: updated });
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setCsvError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Solo se aceptan archivos .csv");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const parsed: Cliente[] = [];
      const parseErrors: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
        const [n, r] = parts;
        if (!n || !r) {
          if (i === 0) continue; // posible header
          parseErrors.push(`Línea ${i + 1}: formato incorrecto`);
          continue;
        }
        if (!RFC_REGEX.test(r)) {
          parseErrors.push(`Línea ${i + 1}: RFC inválido (${r})`);
          continue;
        }
        parsed.push({ nombre: n, rfc: r.toUpperCase() });
      }
      if (parseErrors.length > 0) {
        setCsvError(`Se omitieron ${parseErrors.length} filas con errores: ${parseErrors.slice(0, 3).join("; ")}${parseErrors.length > 3 ? "…" : ""}`);
      }
      if (parsed.length > 0) {
        const merged = [...clientes, ...parsed].slice(0, 500); // max 500 clientes
        onChange({ clientes: merged, skip_cartera: false });
      } else if (parseErrors.length > 0) {
        setCsvError("No se pudo importar ningún cliente del CSV. Revisa el formato: Nombre,RFC");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Agrega los clientes con los que ya operas para que aparezcan en el bot y la web.
        Puedes saltarte este paso y agregarlos después desde el panel.
      </p>

      {/* CSV Upload */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition"
        >
          <Upload className="w-4 h-4" />
          Importar CSV
        </button>
        <span className="text-xs text-slate-400">Formato: Nombre,RFC (una por línea)</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          aria-label="Subir CSV de clientes"
          onChange={handleCsvUpload}
        />
      </div>
      {csvError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {csvError}
        </div>
      )}

      {/* Agregar manual */}
      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-800">Agregar cliente manualmente</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${uid}-cnombre`} className="block text-xs font-medium text-slate-600 mb-1">
              Nombre / Razón social
            </label>
            <input
              id={`${uid}-cnombre`}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Empresa SA de CV"
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition hover:border-slate-400"
            />
          </div>
          <div>
            <label htmlFor={`${uid}-crfc`} className="block text-xs font-medium text-slate-600 mb-1">
              RFC
            </label>
            <input
              id={`${uid}-crfc`}
              type="text"
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase())}
              placeholder="EMP200101AAA"
              maxLength={13}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition hover:border-slate-400 uppercase"
            />
          </div>
        </div>
        {addError && (
          <p role="alert" className="text-xs font-medium text-rose-600">{addError}</p>
        )}
        <button
          type="button"
          onClick={addCliente}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {/* Lista */}
      {clientes.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} en la cartera
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {clientes.map((c, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 transition">
                <div>
                  <span className="text-sm font-medium text-slate-800">{c.nombre}</span>
                  <span className="ml-2 text-xs font-mono text-slate-500">{c.rfc}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeCliente(i)}
                  aria-label={`Eliminar ${c.nombre}`}
                  className="text-slate-400 hover:text-rose-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {clientes.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
          No hay clientes agregados. Puedes importar un CSV o agregar uno por uno.
        </p>
      )}

      {typeof errors.clientes === "string" && (
        <p role="alert" className="text-xs font-medium text-rose-600">{errors.clientes}</p>
      )}
    </div>
  );
}

export function validateStep5(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _data: Partial<OnboardingData>,
): Partial<Record<keyof OnboardingData, string>> {
  // Paso opcional — no hay validación requerida.
  return {};
}
