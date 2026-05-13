"use client";

/**
 * CatalogoPlanesPanel — variante compacta de la tab "Planes" pensada para
 * ocupar el panel lateral del chat (30% del viewport).
 *
 * Resuelve un problema real: el chat conversacional aceptaba combos
 * (grupo + modalidad + plazo + esquema) que no existen en el catálogo de
 * Telcel y reventaba al cotizar. Aquí mostramos el catálogo REAL filtrado
 * para que el vendedor vea qué existe y copie el nombre exacto al chat
 * sin inventar combinaciones imposibles.
 *
 * LUMINA Light: surfaces bg-white, indigo/cyan accents, pill controls,
 * stagger entrance via framer-motion, hairline borders slate-200.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, X } from "lucide-react";
import type { PlanRow, PlanesResponse } from "./types";
import { fmtMxn } from "./types";

const MAX_VISIBLE = 100;

interface Props {
  onCopyToChat: (text: string) => void;
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

export function CatalogoPlanesPanel({ onCopyToChat }: Props) {
  const [planes, setPlanes] = useState<PlanRow[]>([]);
  const [filtros, setFiltros] = useState<{
    grupos: string[];
    modalidades: string[];
    plazos: number[];
  }>({ grupos: [], modalidades: [], plazos: [] });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const [grupo, setGrupo] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [plazo, setPlazo] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (grupo) params.set("grupo", grupo);
      if (modalidad) params.set("modalidad", modalidad);
      if (plazo) params.set("plazo", plazo);
      const url = `/api/catalogos/planes${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      const data: PlanesResponse = await res.json();
      if (data.unavailable) {
        setPlanes([]);
        setTotal(0);
        setUnavailable(true);
        setFiltros({ grupos: [], modalidades: [], plazos: [] });
      } else {
        const ps = Array.isArray(data.planes) ? data.planes : [];
        ps.sort((a, b) => {
          const an = (a.nombre ?? "").toString();
          const bn = (b.nombre ?? "").toString();
          return an.localeCompare(bn, "es-MX");
        });
        setPlanes(ps);
        setTotal(data.total ?? ps.length);
        setUnavailable(false);
        const fd = data.filtros_disponibles ?? {};
        // Solo refrescamos las listas de filtros disponibles cuando el usuario
        // no tiene un grupo seleccionado — porque cuando filtra por grupo el
        // backend devuelve subset de modalidades/plazos válidos para ese grupo
        // (info útil para la jerarquía de combos válidos).
        setFiltros((prev) => ({
          grupos:
            Array.isArray(fd.grupos) && fd.grupos.length > 0
              ? fd.grupos
              : prev.grupos,
          modalidades:
            Array.isArray(fd.modalidades) && fd.modalidades.length > 0
              ? fd.modalidades
              : prev.modalidades,
          plazos:
            Array.isArray(fd.plazos) && fd.plazos.length > 0
              ? fd.plazos
              : prev.plazos,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [grupo, modalidad, plazo]);

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

  const handleCopy = (p: PlanRow) => {
    if (!p.nombre) return;
    const partes = [`Plan: ${p.nombre}`];
    if (typeof p.plazo === "number") partes.push(`Plazo: ${p.plazo} meses`);
    if (p.modalidad) partes.push(`Modalidad: ${p.modalidad}`);
    onCopyToChat(partes.join(" · "));
  };

  // Búsqueda local sobre los planes ya devueltos (rápida, sin extra fetch).
  // Filtros estructurados (grupo/modalidad/plazo) van al server; `q` es
  // sólo refinamiento textual sobre el subset actual.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return planes;
    return planes.filter((p) => {
      const hay =
        (p.nombre ?? "").toLowerCase().includes(needle) ||
        (p.clave ?? "").toLowerCase().includes(needle) ||
        (p.grupo ?? "").toLowerCase().includes(needle) ||
        (p.modalidad ?? "").toLowerCase().includes(needle);
      return hay;
    });
  }, [planes, q]);

  const visibles = filtered.slice(0, MAX_VISIBLE);
  const hayMas = filtered.length > MAX_VISIBLE;
  const totalMostrado = filtered.length;

  const hasFilters = Boolean(grupo || modalidad || plazo || q);
  const clearAll = () => {
    setGrupo("");
    setModalidad("");
    setPlazo("");
    setQ("");
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Filtros */}
      <div className="px-4 pt-1 pb-3 space-y-2 bg-white shrink-0">
        {/* Search pill */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <label htmlFor="catalogo-planes-q" className="sr-only">
            Buscar plan o equipo
          </label>
          <input
            id="catalogo-planes-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar plan o equipo..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="catalogo-planes-grupo" className="sr-only">
              Filtrar por grupo
            </label>
            <select
              id="catalogo-planes-grupo"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              disabled={loading || unavailable}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:bg-slate-100 disabled:text-slate-400 transition"
            >
              <option value="">Todos los grupos</option>
              {filtros.grupos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="catalogo-planes-plazo" className="sr-only">
              Filtrar por plazo
            </label>
            <select
              id="catalogo-planes-plazo"
              value={plazo}
              onChange={(e) => setPlazo(e.target.value)}
              disabled={loading || unavailable}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:bg-slate-100 disabled:text-slate-400 transition"
            >
              <option value="">Todos los plazos</option>
              {filtros.plazos.map((p) => (
                <option key={p} value={String(p)}>
                  {p} meses
                </option>
              ))}
            </select>
          </div>
        </div>

        <label htmlFor="catalogo-planes-modalidad" className="sr-only">
          Filtrar por modalidad
        </label>
        <select
          id="catalogo-planes-modalidad"
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value)}
          disabled={loading || unavailable}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:bg-slate-100 disabled:text-slate-400 transition"
        >
          <option value="">Todas las modalidades</option>
          {filtros.modalidades.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Chips de filtros activos */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {grupo && (
              <FilterChip label={grupo} onClear={() => setGrupo("")} />
            )}
            {modalidad && (
              <FilterChip
                label={modalidad}
                onClear={() => setModalidad("")}
              />
            )}
            {plazo && (
              <FilterChip
                label={`${plazo}m`}
                onClear={() => setPlazo("")}
              />
            )}
            {q && (
              <FilterChip label={`"${q}"`} onClear={() => setQ("")} />
            )}
          </div>
        )}
      </div>

      {/* Counter */}
      <div className="px-4 pb-2 text-[11px] text-slate-500 shrink-0">
        Mostrando{" "}
        <span className="text-slate-900 font-semibold tabular-nums">
          {Math.min(totalMostrado, MAX_VISIBLE)}
        </span>{" "}
        de <span className="tabular-nums">{total}</span>{" "}
        {total === 1 ? "plan" : "planes"}
        {hayMas && (
          <span className="text-slate-400"> · primeros {MAX_VISIBLE}</span>
        )}
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
                className="h-16 bg-slate-100 rounded-xl animate-pulse"
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
              {visibles.map((p, idx) => {
                const renta = p.renta ?? p.precio_lista ?? null;
                return (
                  <motion.li
                    key={`${p.clave ?? "x"}-${idx}`}
                    variants={itemVariants}
                    whileHover={{ scale: 1.01 }}
                    className="group bg-white rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm transition p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          {p.clave && (
                            <span className="font-mono text-[10px] text-cyan-700 bg-cyan-50 rounded-full px-1.5 py-0.5">
                              {p.clave}
                            </span>
                          )}
                          {typeof p.plazo === "number" && (
                            <span className="text-[10px] text-slate-600 bg-slate-100 rounded-full px-1.5 py-0.5 tabular-nums">
                              {p.plazo}m
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                          {p.nombre ?? p.clave ?? "Sin nombre"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-slate-500 truncate">
                            {[p.grupo, p.modalidad]
                              .filter((x) => x && x !== "—")
                              .join(" · ")}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 tabular-nums mt-1">
                          {fmtMxn(renta)}
                          <span className="text-[11px] text-slate-400 font-normal">
                            {" "}
                            /mes
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <ChevronRight
                          className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition"
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(p)}
                          disabled={!p.nombre}
                          className="rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1 text-xs font-medium transition"
                          title="Copiar este plan al chat"
                        >
                          Copiar al chat
                        </button>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium px-2.5 py-0.5 hover:bg-indigo-200 transition"
      aria-label={`Quitar filtro ${label}`}
    >
      {label}
      <X className="w-3 h-3" />
    </button>
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
        <path
          d="M20 26h24M20 32h18M20 38h14"
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
