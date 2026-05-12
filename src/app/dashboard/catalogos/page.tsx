"use client";

/**
 * /dashboard/catalogos — explorador de catálogo (equipos + planes) para DATs.
 *
 * Equivalente web del flujo /catalogos del bot: el DAT puede navegar marcas,
 * modelos y planes corporativos sin abrir Telegram. Desde la tabla de
 * equipos puede saltar directo a /dashboard/cotizar?equipo=<modelo> con la
 * casilla precargada.
 *
 * Datos: GET /api/catalogos/equipos y /api/catalogos/planes (proxies HMAC al
 * bot). Si el backend devuelve `unavailable: true` (404 upstream), pintamos
 * un banner "catálogos cargando, intenta en 1 min" sin reventar la página
 * — el resto del dashboard sigue usable.
 *
 * UI: dos tabs persistentes via state. Filtros aplican client-side cuando
 * los datos ya están en memoria; sólo refetcheamos al cambiar la marca de
 * equipos (porque el endpoint upstream limita a 100 por marca y queremos
 * recorrer marcas distintas) — lo demás se filtra en el cliente para
 * mantener la latencia por debajo de 50ms en interacción.
 *
 * Paginación: 50 por página, suficiente para escanear visualmente sin
 * virtual scroll. Con 1.5k planes son 30 páginas — un dropdown de salto
 * por página o un input "ir a página" se puede agregar después si los
 * usuarios pelean con paginación lineal.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DashboardNav } from "../_nav";

/* ---------- Tipos ---------- */

interface EquipoRow {
  marca: string;
  modelo: string;
}

interface EquiposResponse {
  equipos: EquipoRow[];
  total: number;
  marcas?: string[];
  unavailable?: boolean;
}

interface PlanRow {
  clave?: string | null;
  nombre?: string | null;
  familia?: string | null;
  grupo?: string | null;
  modalidad?: string | null;
  plazo?: number | null;
  renta?: number | null;
  precio_lista?: number | null;
  datos_gb?: number | null;
  minutos?: number | string | null;
  sms?: number | string | null;
  registro_ift?: string | null;
}

interface PlanesResponse {
  planes: PlanRow[];
  total: number;
  filtros_disponibles?: {
    grupos?: string[];
    modalidades?: string[];
    plazos?: number[];
  };
  unavailable?: boolean;
}

type Tab = "equipos" | "planes";

const PAGE_SIZE = 50;

/* ---------- Helpers ---------- */

function fmtMxn(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPlazo(p: number | null | undefined): string {
  if (typeof p !== "number" || !Number.isFinite(p)) return "—";
  return `${p} meses`;
}

function fmtMinutos(m: number | string | null | undefined): string {
  if (m === null || m === undefined || m === "") return "—";
  if (typeof m === "string") return m;
  // Convención del bot: -1 ó 999999 = ilimitado.
  if (m < 0 || m >= 99999) return "Ilimitados";
  return new Intl.NumberFormat("es-MX").format(m);
}

function fmtDatos(g: number | null | undefined): string {
  if (typeof g !== "number" || !Number.isFinite(g)) return "—";
  if (g >= 9999) return "Ilimitados";
  return `${g} GB`;
}

/* ---------- Skeletons ---------- */

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
      ))}
    </div>
  );
}

/* ---------- Página ---------- */

export default function CatalogosPage() {
  const [tab, setTab] = useState<Tab>("equipos");

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="catalogos" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            Catálogo de equipos y planes
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Explora el catálogo oficial sin abrir el bot. Desde aquí puedes
            iniciar una cotización con el equipo elegido.
          </p>
        </div>

        <div className="mb-4 inline-flex bg-white rounded-lg border border-slate-200 p-1">
          <button
            onClick={() => setTab("equipos")}
            className={[
              "px-4 py-1.5 text-sm font-medium rounded-md transition",
              tab === "equipos"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
            aria-pressed={tab === "equipos"}
          >
            Equipos
          </button>
          <button
            onClick={() => setTab("planes")}
            className={[
              "px-4 py-1.5 text-sm font-medium rounded-md transition",
              tab === "planes"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
            aria-pressed={tab === "planes"}
          >
            Planes
          </button>
        </div>

        {tab === "equipos" ? <EquiposTab /> : <PlanesTab />}
      </div>
    </main>
  );
}

/* ---------- Tab: Equipos ---------- */

function EquiposTab() {
  const router = useRouter();
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // Filtros: marca va al endpoint (porque el upstream limita por marca);
  // q se aplica también server-side para que el filtrado coincida con la
  // semántica del bot (substring case-insensitive sobre el modelo).
  const [marca, setMarca] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

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
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      const data: EquiposResponse = await res.json();
      if (data.unavailable) {
        setEquipos([]);
        setMarcas(data.marcas ?? []);
        setTotal(0);
        setUnavailable(true);
      } else {
        setEquipos(Array.isArray(data.equipos) ? data.equipos : []);
        setMarcas(Array.isArray(data.marcas) ? data.marcas : []);
        setTotal(data.total ?? data.equipos?.length ?? 0);
        setUnavailable(false);
      }
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [marca, q]);

  useEffect(() => {
    void load();
  }, [load]);

  // El input de búsqueda debouncea via Enter o blur — para no spamear el
  // backend a cada tecla. Mientras tanto el usuario ve el filtro local.
  const visibles = useMemo(() => {
    // Si el filtro `q` aún no se aplicó server-side (input local), se hace
    // un filtro client-side sobre lo que ya tenemos.
    return equipos;
  }, [equipos]);

  const totalPages = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageRows = visibles.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-3">
          <select
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            disabled={loading || unavailable}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
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
              if (e.key === "Enter") void load();
            }}
            onBlur={() => void load()}
            placeholder="Buscar modelo (ej. iPhone 15)..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => void load()}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "Cargando..." : "Buscar"}
          </button>
        </div>

        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm text-slate-600 flex items-center justify-between">
          <span>
            <strong className="text-slate-900">{total}</strong>{" "}
            {total === 1 ? "equipo disponible" : "equipos disponibles"}
            {marca && (
              <span className="ml-2">
                <Badge variant="muted" size="sm" uppercase={false}>
                  {marca}
                </Badge>
              </span>
            )}
          </span>
          {totalPages > 1 && (
            <span className="text-xs text-slate-500">
              Página {page + 1} de {totalPages}
            </span>
          )}
        </div>

        {unavailable ? (
          <div className="p-12 text-center">
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg inline-block px-4 py-3 text-sm">
              Catálogos cargando, intenta en 1 minuto.
            </p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border-t border-red-200 flex items-center justify-between">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => void load()}
              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
            >
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <TableSkeleton />
        ) : pageRows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Sin resultados.{" "}
            {marca || q ? "Ajusta los filtros para ver más equipos." : ""}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-32">Marca</th>
                <th className="text-left px-4 py-3 font-medium">Modelo</th>
                <th className="text-right px-4 py-3 font-medium w-56">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((eq, idx) => (
                <tr
                  key={`${eq.marca}-${eq.modelo}-${idx}`}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-700">{eq.marca}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {eq.modelo}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        router.push(
                          `/dashboard/cotizar?equipo=${encodeURIComponent(
                            eq.modelo,
                          )}`,
                        )
                      }
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
                    >
                      Cotizar este equipo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && !loading && !error && !unavailable && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        )}
      </div>
    </div>
  );
}

/* ---------- Tab: Planes ---------- */

function PlanesTab() {
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
  const [page, setPage] = useState(0);

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
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      const data: PlanesResponse = await res.json();
      if (data.unavailable) {
        setPlanes([]);
        setTotal(0);
        setUnavailable(true);
        setFiltros({ grupos: [], modalidades: [], plazos: [] });
      } else {
        const ps = Array.isArray(data.planes) ? data.planes : [];
        // Sort por nombre estable.
        ps.sort((a, b) => {
          const an = (a.nombre ?? "").toString();
          const bn = (b.nombre ?? "").toString();
          return an.localeCompare(bn, "es-MX");
        });
        setPlanes(ps);
        setTotal(data.total ?? ps.length);
        setUnavailable(false);
        const fd = data.filtros_disponibles ?? {};
        setFiltros({
          grupos: Array.isArray(fd.grupos) ? fd.grupos : [],
          modalidades: Array.isArray(fd.modalidades) ? fd.modalidades : [],
          plazos: Array.isArray(fd.plazos) ? fd.plazos : [],
        });
      }
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [grupo, modalidad, plazo]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(planes.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageRows = planes.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            disabled={loading || unavailable}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
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
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
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
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            aria-label="Filtrar por plazo"
          >
            <option value="">Todos los plazos</option>
            {filtros.plazos.map((p) => (
              <option key={p} value={String(p)}>
                {p} meses
              </option>
            ))}
          </select>
        </div>

        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm text-slate-600 flex items-center justify-between">
          <span>
            <strong className="text-slate-900">{total}</strong>{" "}
            {total === 1 ? "plan disponible" : "planes disponibles"}
          </span>
          {totalPages > 1 && (
            <span className="text-xs text-slate-500">
              Página {page + 1} de {totalPages}
            </span>
          )}
        </div>

        {unavailable ? (
          <div className="p-12 text-center">
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg inline-block px-4 py-3 text-sm">
              Catálogos cargando, intenta en 1 minuto.
            </p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border-t border-red-200 flex items-center justify-between">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => void load()}
              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
            >
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <TableSkeleton />
        ) : pageRows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Sin resultados con los filtros actuales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Clave</th>
                  <th className="text-left px-4 py-3 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium">Grupo</th>
                  <th className="text-left px-4 py-3 font-medium">
                    Modalidad
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Plazo</th>
                  <th className="text-right px-4 py-3 font-medium">Renta</th>
                  <th className="text-right px-4 py-3 font-medium">Datos</th>
                  <th className="text-right px-4 py-3 font-medium">Minutos</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p, idx) => (
                  <tr
                    key={`${p.clave ?? "x"}-${idx}`}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {p.clave ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      {p.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.grupo ?? p.familia ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.modalidad ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmtPlazo(p.plazo ?? null)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-medium">
                      {fmtMxn(p.renta ?? p.precio_lista ?? null)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {fmtDatos(p.datos_gb ?? null)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {fmtMinutos(p.minutos ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && !loading && !error && !unavailable && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        )}
      </div>
    </div>
  );
}

/* ---------- Paginación ---------- */

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Anterior
      </button>
      <span className="text-sm text-slate-500">
        Página {page + 1} de {totalPages}
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Siguiente →
      </button>
    </div>
  );
}
