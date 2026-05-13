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
 * Layouts (audit B2):
 *  - Equipos: grid de cards (sin foto — typography grande con marca + modelo).
 *    Cards porque equipo es navegacional: el usuario escanea modelos y los
 *    selecciona; las cards rinden bien en grid responsive sin scroll-x.
 *  - Planes: tabla en md+ (8 columnas para comparar lado a lado es el caso
 *    real de uso del DAT cuando arma cotización); cards stacked en mobile
 *    con columnas secundarias (clave, sms) ocultas.
 *
 * Performance: 928 equipos / 1584 planes paginados a 50/página — son 18-31
 * páginas. Sin virtualización: el render del subset de 50 DOM nodes es
 * sub-frame en hardware del piloto (Chromebook/iPad). Si en piloto vemos
 * complaint de scroll lag al cargar TODO el array en `planes` state,
 * migramos a virtualization (react-virtuoso) — por ahora es over-engineering.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardNav } from "../_nav";

/* ---------- Tipos ---------- */

interface EquipoRow {
  marca: string;
  modelo: string;
  precio?: number | null;
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
  if (m < 0 || m >= 99999) return "Ilimitados";
  return new Intl.NumberFormat("es-MX").format(m);
}

function fmtDatos(g: number | null | undefined): string {
  if (typeof g !== "number" || !Number.isFinite(g)) return "—";
  if (g >= 9999) return "Ilimitados";
  return `${g} GB`;
}

/* ---------- Página ---------- */

export default function CatalogosPage() {
  const [tab, setTab] = useState<Tab>("equipos");

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="catalogos" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Catálogo
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Explora equipos y planes corporativos. Lanza una cotización con el
            modelo elegido en un click.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Catálogo: equipos o planes"
          className="mb-6 inline-flex bg-white rounded-lg border border-slate-200 p-1"
        >
          <button
            role="tab"
            aria-selected={tab === "equipos"}
            aria-controls="tabpanel-equipos"
            id="tab-equipos"
            onClick={() => setTab("equipos")}
            className={[
              "px-4 py-1.5 text-sm font-medium rounded-md transition",
              tab === "equipos"
                ? "bg-blue-700 text-white"
                : "text-slate-700 hover:text-slate-900",
            ].join(" ")}
          >
            Equipos
          </button>
          <button
            role="tab"
            aria-selected={tab === "planes"}
            aria-controls="tabpanel-planes"
            id="tab-planes"
            onClick={() => setTab("planes")}
            className={[
              "px-4 py-1.5 text-sm font-medium rounded-md transition",
              tab === "planes"
                ? "bg-blue-700 text-white"
                : "text-slate-700 hover:text-slate-900",
            ].join(" ")}
          >
            Planes
          </button>
        </div>

        {tab === "equipos" ? (
          <div
            role="tabpanel"
            id="tabpanel-equipos"
            aria-labelledby="tab-equipos"
          >
            <EquiposTab />
          </div>
        ) : (
          <div
            role="tabpanel"
            id="tabpanel-planes"
            aria-labelledby="tab-planes"
          >
            <PlanesTab />
          </div>
        )}
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

  const [marca, setMarca] = useState("");
  const [q, setQ] = useState("");
  // Filtro de precio aplica client-side (el upstream no lo soporta).
  const [precioMax, setPrecioMax] = useState<string>("");
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

  const filtered = useMemo(() => {
    const maxNum = Number(precioMax);
    if (!precioMax || !Number.isFinite(maxNum) || maxNum <= 0) return equipos;
    return equipos.filter((e) => {
      if (typeof e.precio !== "number" || !Number.isFinite(e.precio))
        return true;
      return e.precio <= maxNum;
    });
  }, [equipos, precioMax]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor="eq-marca"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Marca
          </label>
          <select
            id="eq-marca"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            disabled={loading || unavailable}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Todas las marcas</option>
            {marcas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor="eq-q"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Buscar modelo
          </label>
          <input
            id="eq-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
            onBlur={() => void load()}
            placeholder="ej. iPhone 15, Galaxy S24"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
          />
        </div>
        <div>
          <label
            htmlFor="eq-precio"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Precio máx (MXN)
          </label>
          <input
            id="eq-precio"
            type="number"
            inputMode="numeric"
            min={0}
            value={precioMax}
            onChange={(e) => {
              setPrecioMax(e.target.value);
              setPage(0);
            }}
            placeholder="Sin tope"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
          />
        </div>
      </div>

      <ResultMeta
        total={total}
        showing={filtered.length}
        page={page}
        totalPages={totalPages}
        unit={total === 1 ? "equipo" : "equipos"}
      />

      {unavailable ? (
        <UnavailableBanner />
      ) : error ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : loading ? (
        <GridSkeleton />
      ) : pageRows.length === 0 ? (
        <EmptyMessage
          msg={
            marca || q || precioMax
              ? "Sin resultados. Ajusta los filtros."
              : "No hay equipos en el catálogo."
          }
        />
      ) : (
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          aria-label="Equipos"
        >
          {pageRows.map((eq, idx) => (
            <li key={`${eq.marca}-${eq.modelo}-${idx}`}>
              <EquipoCard
                eq={eq}
                onCotizar={() =>
                  router.push(
                    `/dashboard/cotizar?equipo=${encodeURIComponent(eq.modelo)}`
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && !loading && !error && !unavailable && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

function EquipoCard({
  eq,
  onCotizar,
}: {
  eq: EquipoRow;
  onCotizar: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-400 hover:shadow-sm transition flex flex-col h-full">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
        {eq.marca}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900 leading-snug">
        {eq.modelo}
      </p>
      {typeof eq.precio === "number" && eq.precio > 0 && (
        <p className="mt-2 text-sm text-slate-600 tabular-nums">
          {fmtMxn(eq.precio)}
        </p>
      )}
      <button
        onClick={onCotizar}
        className="mt-4 w-full px-3 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 transition"
      >
        Cotizar este equipo
      </button>
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
  const [q, setQ] = useState("");
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

  // Búsqueda local por clave/nombre (no spamea upstream).
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return planes;
    return planes.filter(
      (p) =>
        (p.clave ?? "").toLowerCase().includes(needle) ||
        (p.nombre ?? "").toLowerCase().includes(needle)
    );
  }, [planes, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor="pl-q"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Buscar plan
          </label>
          <input
            id="pl-q"
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Clave o nombre"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
          />
        </div>
        <div>
          <label
            htmlFor="pl-grupo"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Grupo
          </label>
          <select
            id="pl-grupo"
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            disabled={loading || unavailable}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Todos</option>
            {filtros.grupos.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="pl-modalidad"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Modalidad
          </label>
          <select
            id="pl-modalidad"
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value)}
            disabled={loading || unavailable}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Todas</option>
            {filtros.modalidades.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="pl-plazo"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Plazo
          </label>
          <select
            id="pl-plazo"
            value={plazo}
            onChange={(e) => setPlazo(e.target.value)}
            disabled={loading || unavailable}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Todos</option>
            {filtros.plazos.map((p) => (
              <option key={p} value={String(p)}>
                {p} meses
              </option>
            ))}
          </select>
        </div>
      </div>

      <ResultMeta
        total={total}
        showing={filtered.length}
        page={page}
        totalPages={totalPages}
        unit={total === 1 ? "plan" : "planes"}
      />

      {unavailable ? (
        <UnavailableBanner />
      ) : error ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : loading ? (
        <TableSkeleton />
      ) : pageRows.length === 0 ? (
        <EmptyMessage msg="Sin resultados con los filtros actuales." />
      ) : (
        <>
          <PlanesTable rows={pageRows} />
          <PlanesCards rows={pageRows} />
        </>
      )}

      {totalPages > 1 && !loading && !error && !unavailable && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

function PlanesTable({ rows }: { rows: PlanRow[] }) {
  return (
    <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Catálogo de planes con clave, nombre, grupo, modalidad, plazo, renta,
          datos y minutos.
        </caption>
        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
          <tr>
            <th
              scope="col"
              className="text-left px-4 py-3 font-medium hidden lg:table-cell"
            >
              Clave
            </th>
            <th scope="col" className="text-left px-4 py-3 font-medium">
              Nombre
            </th>
            <th
              scope="col"
              className="text-left px-4 py-3 font-medium hidden xl:table-cell"
            >
              Grupo
            </th>
            <th scope="col" className="text-left px-4 py-3 font-medium">
              Modalidad
            </th>
            <th scope="col" className="text-left px-4 py-3 font-medium">
              Plazo
            </th>
            <th scope="col" className="text-right px-4 py-3 font-medium">
              Renta
            </th>
            <th scope="col" className="text-right px-4 py-3 font-medium">
              Datos
            </th>
            <th
              scope="col"
              className="text-right px-4 py-3 font-medium hidden xl:table-cell"
            >
              Minutos
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, idx) => (
            <tr
              key={`${p.clave ?? "x"}-${idx}`}
              className="border-t border-slate-100 hover:bg-slate-50 transition"
            >
              <td className="px-4 py-3 font-mono text-xs text-slate-600 hidden lg:table-cell">
                {p.clave ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-900 font-medium">
                {p.nombre ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-700 hidden xl:table-cell">
                {p.grupo ?? p.familia ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-700">{p.modalidad ?? "—"}</td>
              <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                {fmtPlazo(p.plazo ?? null)}
              </td>
              <td className="px-4 py-3 text-right text-slate-900 font-medium tabular-nums">
                {fmtMxn(p.renta ?? p.precio_lista ?? null)}
              </td>
              <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                {fmtDatos(p.datos_gb ?? null)}
              </td>
              <td className="px-4 py-3 text-right text-slate-700 tabular-nums hidden xl:table-cell">
                {fmtMinutos(p.minutos ?? null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanesCards({ rows }: { rows: PlanRow[] }) {
  return (
    <ul className="md:hidden space-y-3" aria-label="Planes">
      {rows.map((p, idx) => (
        <li
          key={`${p.clave ?? "x"}-${idx}`}
          className="bg-white rounded-xl border border-slate-200 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 leading-snug">
                {p.nombre ?? "—"}
              </p>
              {p.clave && (
                <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                  {p.clave}
                </p>
              )}
            </div>
            <p className="text-lg font-bold text-slate-900 tabular-nums shrink-0">
              {fmtMxn(p.renta ?? p.precio_lista ?? null)}
            </p>
          </div>
          <dl className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-slate-500">Modalidad</dt>
              <dd className="text-slate-800 mt-0.5">{p.modalidad ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Plazo</dt>
              <dd className="text-slate-800 mt-0.5">
                {fmtPlazo(p.plazo ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Datos</dt>
              <dd className="text-slate-800 tabular-nums mt-0.5">
                {fmtDatos(p.datos_gb ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Minutos</dt>
              <dd className="text-slate-800 tabular-nums mt-0.5">
                {fmtMinutos(p.minutos ?? null)}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Compartido ---------- */

function ResultMeta({
  total,
  showing,
  page,
  totalPages,
  unit,
}: {
  total: number;
  showing: number;
  page: number;
  totalPages: number;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
      <span>
        <strong className="text-slate-900 tabular-nums">{showing}</strong> de{" "}
        <strong className="text-slate-900 tabular-nums">{total}</strong> {unit}
      </span>
      {totalPages > 1 && (
        <span className="text-slate-500">
          Página{" "}
          <span className="tabular-nums">
            {page + 1}/{totalPages}
          </span>
        </span>
      )}
    </div>
  );
}

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
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between text-sm text-slate-600 flex-wrap gap-3 pt-2"
    >
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        ← Anterior
      </button>
      <span className="text-slate-500 text-xs">
        Página{" "}
        <span className="tabular-nums">
          {page + 1} de {totalPages}
        </span>
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        Siguiente →
      </button>
    </nav>
  );
}

function UnavailableBanner() {
  return (
    <div className="bg-white rounded-xl border border-amber-200 p-6 text-center">
      <p className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold uppercase tracking-wider rounded-full px-3 py-1">
        Catálogo cargando
      </p>
      <p className="mt-3 text-sm text-slate-700">
        El catálogo se está sincronizando. Intenta de nuevo en aproximadamente 1
        minuto.
      </p>
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
    >
      <p className="text-red-800 text-sm font-medium">{message}</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 transition"
      >
        Reintentar
      </button>
    </div>
  );
}

function EmptyMessage({ msg }: { msg: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-600 text-sm">
      {msg}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando catálogo…</span>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-3"
          aria-hidden="true"
        >
          <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
          <div className="h-5 bg-slate-100 rounded animate-pulse w-3/4" />
          <div className="h-8 bg-slate-100 rounded animate-pulse w-full mt-4" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-6 space-y-3"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando planes…</span>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-10 bg-slate-100 rounded animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
