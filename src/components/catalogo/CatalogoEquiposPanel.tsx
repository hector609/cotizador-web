"use client";

/**
 * CatalogoEquiposPanel — variante compacta del listado de equipos para el
 * panel lateral del chat. Mismo razonamiento que CatalogoPlanesPanel: el
 * vendedor copia el nombre EXACTO del modelo al chat para evitar typos
 * que reventarían la cotización.
 *
 * Filtros: marca (selector) + búsqueda libre (debounce on blur/Enter).
 * Backend ya filtra por marca; `q` también va al upstream para mantener
 * paridad semántica con el flujo del bot.
 *
 * Vista: lista de cards densas (marca + modelo + botón Copiar). No tabla
 * — el panel es demasiado angosto.
 */

import { useCallback, useEffect, useState } from "react";
import type { EquipoRow, EquiposResponse } from "./types";

const MAX_VISIBLE = 100;

interface Props {
  onCopyToChat: (text: string) => void;
}

export function CatalogoEquiposPanel({ onCopyToChat }: Props) {
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const [marca, setMarca] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (marca) params.set("marca", marca);
      if (q.trim()) params.set("q", q.trim());
      const url = `/api/catalogos/equipos${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      const data: EquiposResponse = await res.json();
      if (data.unavailable) {
        setEquipos([]);
        setMarcas(data.marcas ?? []);
        setTotal(0);
        setUnavailable(true);
      } else {
        setEquipos(Array.isArray(data.equipos) ? data.equipos : []);
        // Preservamos la lista de marcas la primera vez (cuando el backend
        // la regresa sin filtro). Cuando el usuario filtra por marca el
        // upstream ya no envía el array completo; usar `prev` evita que
        // se pierda el dropdown.
        setMarcas((prev) =>
          Array.isArray(data.marcas) && data.marcas.length > 0
            ? data.marcas
            : prev,
        );
        setTotal(data.total ?? data.equipos?.length ?? 0);
        setUnavailable(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [marca, q]);

  // Difiere el dispatch al micro-task siguiente para no llamar setState
  // síncronamente dentro del effect body (regla react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleCopy = (eq: EquipoRow) => {
    onCopyToChat(`Equipo: ${eq.modelo}`);
  };

  const visibles = equipos.slice(0, MAX_VISIBLE);
  const hayMas = equipos.length > MAX_VISIBLE;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filtros */}
      <div className="p-3 border-b border-slate-200 space-y-2 bg-slate-50 shrink-0">
        <select
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          disabled={loading || unavailable}
          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="Filtrar por marca"
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void load();
            }
          }}
          onBlur={() => void load()}
          placeholder="Buscar modelo..."
          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label="Buscar modelo"
        />
        {(marca || q) && (
          <button
            type="button"
            onClick={() => {
              setMarca("");
              setQ("");
            }}
            className="text-[11px] text-slate-500 hover:text-slate-900 underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Header de resultados */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 text-[11px] text-slate-600 shrink-0">
        <strong className="text-slate-900">{total}</strong>{" "}
        {total === 1 ? "equipo disponible" : "equipos disponibles"}
        {hayMas && (
          <span className="text-slate-400"> · mostrando {MAX_VISIBLE}</span>
        )}
      </div>

      {/* Lista scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white">
        {unavailable ? (
          <div className="p-6 text-center">
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-md inline-block px-3 py-2 text-xs">
              Catálogos cargando, intenta en 1 min.
            </p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border-t border-red-200">
            <p className="text-red-700 text-xs mb-2">{error}</p>
            <button
              onClick={() => void load()}
              className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition"
            >
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-12 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            Sin equipos con esos filtros.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibles.map((eq, idx) => (
              <li
                key={`${eq.marca}-${eq.modelo}-${idx}`}
                className="p-3 hover:bg-slate-50 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                      {eq.marca}
                    </p>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                      {eq.modelo}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(eq)}
                    className="shrink-0 px-2 py-1 bg-blue-600 text-white text-[11px] font-medium rounded hover:bg-blue-700 transition"
                    title="Copiar este equipo al chat"
                  >
                    Copiar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
