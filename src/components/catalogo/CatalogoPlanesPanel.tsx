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
 * Diferencias con la página /dashboard/catalogos:
 *   - Layout vertical denso (cards, no tabla — el ancho no alcanza para
 *     8 columnas).
 *   - Cada plan tiene botón "Copiar al chat" que invoca el callback del
 *     padre con el nombre exacto + plazo (NO auto-envía: pega texto en
 *     el composer y el vendedor decide).
 *   - Sin paginación visible — scroll vertical infinito dentro del panel.
 *     Telcel tiene ~1.5k planes total; ya filtrados por grupo+modalidad+
 *     plazo típicamente quedan 10-40. Si el usuario no filtra mostramos
 *     los primeros 100 + un hint.
 *   - Fuente de datos idéntica (proxy /api/catalogos/planes), así que
 *     una sola "verdad" de catálogo en toda la app.
 */

import { useCallback, useEffect, useState } from "react";
import type { PlanRow, PlanesResponse } from "./types";
import { fmtMxn, fmtPlazo } from "./types";

const MAX_VISIBLE = 100;

interface Props {
  onCopyToChat: (text: string) => void;
}

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

  const visibles = planes.slice(0, MAX_VISIBLE);
  const hayMas = planes.length > MAX_VISIBLE;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filtros */}
      <div className="p-3 border-b border-slate-200 space-y-2 bg-slate-50 shrink-0">
        <select
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          disabled={loading || unavailable}
          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="Filtrar por grupo"
        >
          <option value="">Todos los grupos</option>
          {filtros.grupos.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value)}
          disabled={loading || unavailable}
          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="Filtrar por modalidad"
        >
          <option value="">Todas las modalidades</option>
          {filtros.modalidades.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={plazo}
          onChange={(e) => setPlazo(e.target.value)}
          disabled={loading || unavailable}
          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="Filtrar por plazo"
        >
          <option value="">Todos los plazos</option>
          {filtros.plazos.map((p) => (
            <option key={p} value={String(p)}>
              {p} meses
            </option>
          ))}
        </select>
        {(grupo || modalidad || plazo) && (
          <button
            type="button"
            onClick={() => {
              setGrupo("");
              setModalidad("");
              setPlazo("");
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
        {total === 1 ? "plan disponible" : "planes disponibles"}
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
                className="h-14 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            Sin planes con esos filtros.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibles.map((p, idx) => (
              <li
                key={`${p.clave ?? "x"}-${idx}`}
                className="p-3 hover:bg-slate-50 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {p.nombre ?? p.clave ?? "Sin nombre"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {[
                        p.grupo,
                        p.modalidad,
                        fmtPlazo(p.plazo ?? null),
                      ]
                        .filter((x) => x && x !== "—")
                        .join(" · ")}
                    </p>
                    <p className="text-[11px] text-slate-700 font-medium mt-0.5">
                      {fmtMxn(p.renta ?? p.precio_lista ?? null)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(p)}
                    disabled={!p.nombre}
                    className="shrink-0 px-2 py-1 bg-blue-600 text-white text-[11px] font-medium rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Copiar este plan al chat"
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
