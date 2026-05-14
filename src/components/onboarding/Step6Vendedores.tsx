"use client";

/**
 * Step6Vendedores — Equipo de vendedores (OPCIONAL).
 * Permite agregar vendedores con nombre + Telegram ID.
 */

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { OnboardingData } from "@/lib/onboardingApi";

interface Vendedor {
  nombre: string;
  telegram_id: string;
}

interface Props {
  data: Partial<OnboardingData>;
  onChange: (patch: Partial<OnboardingData>) => void;
  errors: Partial<Record<keyof OnboardingData, string>>;
}

export function Step6Vendedores({ data, onChange, errors }: Props) {
  const uid = useId();
  const vendedores: Vendedor[] = data.vendedores ?? [];
  const [nombre, setNombre] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  function addVendedor() {
    setAddError(null);
    if (!nombre.trim()) { setAddError("El nombre es obligatorio."); return; }
    const tidRaw = telegramId.trim();
    if (!tidRaw) { setAddError("El Telegram ID es obligatorio."); return; }
    const tid = tidRaw.replace(/\D/g, "");
    if (!tid || isNaN(Number(tid))) {
      setAddError("El Telegram ID debe ser un número entero (ej. 12345678). Pídele al vendedor que envíe /whoami al bot.");
      return;
    }
    // Prevent duplicates
    if (vendedores.some((v) => v.telegram_id === tid)) {
      setAddError("Este Telegram ID ya está en la lista.");
      return;
    }
    const updated = [...vendedores, { nombre: nombre.trim(), telegram_id: tid }];
    onChange({ vendedores: updated, skip_vendedores: false });
    setNombre("");
    setTelegramId("");
  }

  function removeVendedor(idx: number) {
    const updated = vendedores.filter((_, i) => i !== idx);
    onChange({ vendedores: updated });
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-100 text-sm text-cyan-700">
        <p className="font-semibold mb-1">Cómo obtener el Telegram ID de un vendedor</p>
        <p>
          Pídele al vendedor que abra el bot{" "}
          <a
            href="https://t.me/CotizadorInteligenteBot"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            @CotizadorInteligenteBot
          </a>{" "}
          y envíe el comando <code className="bg-cyan-100 px-1 rounded">/whoami</code>. El bot responde con su ID numérico.
        </p>
      </div>

      {/* Agregar vendedor */}
      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-800">Agregar vendedor</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${uid}-vnombre`} className="block text-xs font-medium text-slate-600 mb-1">
              Nombre completo
            </label>
            <input
              id={`${uid}-vnombre`}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan Pérez"
              maxLength={80}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition hover:border-slate-400"
            />
          </div>
          <div>
            <label htmlFor={`${uid}-vtid`} className="block text-xs font-medium text-slate-600 mb-1">
              Telegram ID (número)
            </label>
            <input
              id={`${uid}-vtid`}
              type="text"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="12345678"
              inputMode="numeric"
              maxLength={15}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition hover:border-slate-400"
            />
          </div>
        </div>
        {addError && (
          <p role="alert" className="text-xs font-medium text-rose-600">{addError}</p>
        )}
        <button
          type="button"
          onClick={addVendedor}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Agregar vendedor
        </button>
      </div>

      {/* Lista de vendedores */}
      {vendedores.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">
            {vendedores.length} vendedor{vendedores.length !== 1 ? "es" : ""} en el equipo
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {vendedores.map((v, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 transition">
                <div>
                  <span className="text-sm font-medium text-slate-800">{v.nombre}</span>
                  <span className="ml-2 text-xs font-mono text-slate-500">ID: {v.telegram_id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeVendedor(i)}
                  aria-label={`Eliminar ${v.nombre}`}
                  className="text-slate-400 hover:text-rose-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {vendedores.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
          No hay vendedores agregados. Puedes hacerlo ahora o después desde el panel.
        </p>
      )}

      {typeof errors.vendedores === "string" && (
        <p role="alert" className="text-xs font-medium text-rose-600">{errors.vendedores}</p>
      )}
    </div>
  );
}

export function validateStep6(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _data: Partial<OnboardingData>,
): Partial<Record<keyof OnboardingData, string>> {
  // Paso opcional — no hay validación requerida.
  return {};
}
