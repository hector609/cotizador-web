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
 * Vista LUMINA Light: surfaces bg-white, cards rounded-xl border slate-100,
 * thumbnail con sigla marca en gradient indigo→cyan, stagger entrance via
 * framer-motion, pill search con icon, pill outline "Copiar al chat".
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import type { EquipoRow, EquiposResponse } from "./types";

const MAX_VISIBLE = 100;

interface Props {
  onCopyToChat: (text: string) => void;
}

// Sigla de marca: primera letra de cada palabra, máx 2 chars.
function siglaMarca(marca: string): string {
  if (!marca) return "?";
  const parts = marca.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return marca.slice(0, 2).toUpperCase();
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

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

  const visibles = useMemo(() => equipos.slice(0, MAX_VISIBLE), [equipos]);
  const hayMas = equipos.length > MAX_VISIBLE;

  const hasFilters = Boolean(marca || q);
  const clearAll = () => {
    setMarca("");
    setQ("");
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Filtros */}
      <div className="px-4 pt-1 pb-3 space-y-2 bg-white shrink-0">
        {/* Search pill */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <label htmlFor="catalogo-equipos-q" className="sr-only">
            Buscar plan o equipo
          </label>
          <input
            id="catalogo-equipos-q"
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
            placeholder="Buscar plan o equipo..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition"
          />
        </div>

        {/* Marca selector */}
        <label htmlFor="catalogo-equipos-marca" className="sr-only">
          Filtrar por marca
        </label>
        <select
          id="catalogo-equipos-marca"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          disabled={loading || unavailable}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:bg-slate-100 disabled:text-slate-400 transition"
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Chips de filtros activos */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {marca && (
              <button
                type="button"
                onClick={() => setMarca("")}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium px-2.5 py-0.5 hover:bg-indigo-200 transition"
                aria-label={`Quitar filtro marca ${marca}`}
              >
                {marca}
                <X className="w-3 h-3" />
              </button>
            )}
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium px-2.5 py-0.5 hover:bg-indigo-200 transition"
                aria-label={`Quitar búsqueda ${q}`}
              >
                &ldquo;{q}&rdquo;
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Counter */}
      <div className="px-4 pb-2 text-[11px] text-slate-500 shrink-0">
        Mostrando{" "}
        <span className="text-slate-900 font-semibold tabular-nums">
          {Math.min(total, MAX_VISIBLE)}
        </span>{" "}
        de <span className="tabular-nums">{total}</span>{" "}
        {total === 1 ? "equipo" : "equipos"}
        {hayMas && <span className="text-slate-400"> · primeros {MAX_VISIBLE}</span>}
      </div>

      {/* Lista scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth px-3 pb-4">
        {unavailable ? (
          <div className="p-6 text-center">
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl inline-block px-3 py-2 text-xs">
              Catálogos cargando, intenta en 1 min.
            </p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 text-xs mb-2">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full px-3 py-1 bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition"
            >
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2 pt-1">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-14 bg-slate-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState onClear={clearAll} hasFilters={hasFilters} />
        ) : (
          <motion.ul
            className="space-y-1.5 pt-1"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence initial={false}>
              {visibles.map((eq, idx) => (
                <motion.li
                  key={`${eq.marca}-${eq.modelo}-${idx}`}
                  variants={itemVariants}
                  whileHover={{ scale: 1.01 }}
                  className="group bg-white rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm transition p-3"
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail circle con sigla marca */}
                    <div
                      className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center text-[11px] font-bold text-indigo-700"
                      aria-hidden="true"
                    >
                      {siglaMarca(eq.marca)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-tight">
                        {eq.marca}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 truncate leading-tight mt-0.5">
                        {eq.modelo}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(eq)}
                      className="shrink-0 rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1 text-xs font-medium transition"
                      title="Copiar este equipo al chat"
                    >
                      Copiar al chat
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  onClear,
  hasFilters,
}: {
  onClear: () => void;
  hasFilters: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center py-10 px-6 text-center"
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="mb-3"
      >
        <rect
          x="12"
          y="14"
          width="40"
          height="36"
          rx="6"
          stroke="#E2E8F0"
          strokeWidth="2"
        />
        <circle cx="28" cy="30" r="6" stroke="#CBD5E1" strokeWidth="2" />
        <path
          d="M33 35l5 5"
          stroke="#CBD5E1"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-sm font-semibold text-slate-700">Sin resultados</p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 text-xs font-medium text-cyan-700 hover:text-cyan-800 underline-offset-2 hover:underline transition"
        >
          Limpiar filtros
        </button>
      )}
    </motion.div>
  );
}
