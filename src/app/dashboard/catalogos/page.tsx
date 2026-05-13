"use client";

/**
 * /dashboard/catalogos — explorador de catálogo (equipos + planes) para DATs.
 *
 * Equivalente web del flujo /catalogos del bot: el DAT puede navegar marcas,
 * modelos y planes corporativos sin abrir Telegram. Desde la tabla de
 * equipos puede saltar directo a /dashboard/cotizar?equipo=<modelo>.
 *
 * REDISEÑO "REVENTAR mode" — dark glassmorphism premium. Hooks y data
 * fetching INTACTOS; capa visual nueva.
 *
 * Layouts (audit B2):
 *  - Equipos: grid de cards con typography grande marca + modelo.
 *  - Planes: tabla densa md+ con columnas progresivamente ocultas
 *    (hidden lg:table-cell, xl:table-cell) + búsqueda clave/nombre.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { Sidebar } from "@/components/admin/Sidebar";

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
    <div className="min-h-screen bg-[#0b1326] text-slate-200 antialiased">
      <Sidebar active="catalogos" />

      <main className="relative lg:ml-64 pt-14 lg:pt-0 min-h-screen overflow-hidden">
        {/* Mesh + grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% 15%, rgba(29, 78, 216, 0.18) 0%, transparent 45%), radial-gradient(circle at 95% 5%, rgba(76, 215, 246, 0.12) 0%, transparent 35%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
            <Link href="/dashboard" className="hover:text-white transition">
              Inicio
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-white">Catálogo</span>
          </div>

          {/* H1 */}
          <header className="mb-8">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
              Catálogo
            </h1>
            <p className="mt-3 text-sm md:text-base text-slate-400 max-w-2xl">
              Explora equipos y planes corporativos. Lanza una cotización con el
              modelo elegido en un click.
            </p>
          </header>

          {/* Tabs pill segmented */}
          <div
            role="tablist"
            aria-label="Catálogo: equipos o planes"
            className="mb-6 inline-flex bg-white/[0.04] backdrop-blur-[12px] rounded-full border border-white/10 p-1"
          >
            <button
              role="tab"
              aria-selected={tab === "equipos"}
              aria-controls="tabpanel-equipos"
              id="tab-equipos"
              onClick={() => setTab("equipos")}
              className={[
                "px-5 py-1.5 text-sm font-bold rounded-full transition",
                tab === "equipos"
                  ? "bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                  : "text-slate-400 hover:text-white",
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
                "px-5 py-1.5 text-sm font-bold rounded-full transition",
                tab === "planes"
                  ? "bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                  : "text-slate-400 hover:text-white",
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
    </div>
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
  const [precioMax, setPrecioMax] = useState<string>("");
  const [page, setPage] = useState(0);

  const marcaId = useId();
  const qId = useId();
  const precioId = useId();

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
      {/* Filtros pills */}
      <div className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor={marcaId}
            className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
          >
            Marca
          </label>
          <select
            id={marcaId}
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            disabled={loading || unavailable}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition disabled:opacity-50"
          >
            <option value="" className="bg-[#0b1326]">Todas las marcas</option>
            {marcas.map((m) => (
              <option key={m} value={m} className="bg-[#0b1326]">
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor={qId}
            className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
          >
            Buscar modelo
          </label>
          <input
            id={qId}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
            onBlur={() => void load()}
            placeholder="ej. iPhone 15, Galaxy S24"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition"
          />
        </div>
        <div>
          <label
            htmlFor={precioId}
            className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
          >
            Precio máx (MXN)
          </label>
          <input
            id={precioId}
            type="number"
            inputMode="numeric"
            min={0}
            value={precioMax}
            onChange={(e) => {
              setPrecioMax(e.target.value);
              setPage(0);
            }}
            placeholder="Sin tope"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition"
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
    <div className="group relative rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-5 transition-all duration-300 hover:scale-[1.02] hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] flex flex-col h-full">
      <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
        {eq.marca}
      </p>
      <p className="mt-2 text-xl font-black text-white leading-tight tracking-tight">
        {eq.modelo}
      </p>
      {typeof eq.precio === "number" && eq.precio > 0 && (
        <p className="mt-3 text-sm text-slate-300 tabular-nums">
          {fmtMxn(eq.precio)}
        </p>
      )}
      <button
        onClick={onCotizar}
        className="mt-auto pt-4 w-full"
      >
        <span className="block w-full px-3 py-2 bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-bold rounded-lg hover:bg-cyan-500/25 hover:border-cyan-400/50 transition">
          Cotizar este equipo
        </span>
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

  const qId = useId();
  const grupoId = useId();
  const modId = useId();
  const plazoId = useId();

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
      <div className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor={qId}
            className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
          >
            Buscar plan
          </label>
          <input
            id={qId}
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Clave o nombre"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition"
          />
        </div>
        <div>
          <label
            htmlFor={grupoId}
            className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
          >
            Grupo
          </label>
          <select
            id={grupoId}
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            disabled={loading || unavailable}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition disabled:opacity-50"
          >
            <option value="" className="bg-[#0b1326]">Todos</option>
            {filtros.grupos.map((g) => (
              <option key={g} value={g} className="bg-[#0b1326]">
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={modId}
            className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
          >
            Modalidad
          </label>
          <select
            id={modId}
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value)}
            disabled={loading || unavailable}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition disabled:opacity-50"
          >
            <option value="" className="bg-[#0b1326]">Todas</option>
            {filtros.modalidades.map((m) => (
              <option key={m} value={m} className="bg-[#0b1326]">
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={plazoId}
            className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
          >
            Plazo
          </label>
          <select
            id={plazoId}
            value={plazo}
            onChange={(e) => setPlazo(e.target.value)}
            disabled={loading || unavailable}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition disabled:opacity-50"
          >
            <option value="" className="bg-[#0b1326]">Todos</option>
            {filtros.plazos.map((p) => (
              <option key={p} value={String(p)} className="bg-[#0b1326]">
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
    <div className="hidden md:block rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Catálogo de planes con clave, nombre, grupo, modalidad, plazo, renta,
          datos y minutos.
        </caption>
        <thead className="bg-white/[0.02] text-slate-500 uppercase text-[10px] tracking-widest font-bold border-b border-white/10">
          <tr>
            <th
              scope="col"
              className="text-left px-5 py-3 hidden lg:table-cell"
            >
              Clave
            </th>
            <th scope="col" className="text-left px-5 py-3">
              Nombre
            </th>
            <th
              scope="col"
              className="text-left px-5 py-3 hidden xl:table-cell"
            >
              Grupo
            </th>
            <th scope="col" className="text-left px-5 py-3">
              Modalidad
            </th>
            <th scope="col" className="text-left px-5 py-3">
              Plazo
            </th>
            <th scope="col" className="text-right px-5 py-3">
              Renta
            </th>
            <th scope="col" className="text-right px-5 py-3">
              Datos
            </th>
            <th
              scope="col"
              className="text-right px-5 py-3 hidden xl:table-cell"
            >
              Minutos
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((p, idx) => (
            <tr
              key={`${p.clave ?? "x"}-${idx}`}
              className="hover:bg-white/[0.03] transition-colors"
            >
              <td className="px-5 py-3.5 font-mono text-xs text-cyan-300 hidden lg:table-cell">
                {p.clave ?? "—"}
              </td>
              <td className="px-5 py-3.5 text-white font-medium">
                {p.nombre ?? "—"}
              </td>
              <td className="px-5 py-3.5 text-slate-400 hidden xl:table-cell">
                {p.grupo ?? p.familia ?? "—"}
              </td>
              <td className="px-5 py-3.5 text-slate-300">{p.modalidad ?? "—"}</td>
              <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">
                {fmtPlazo(p.plazo ?? null)}
              </td>
              <td className="px-5 py-3.5 text-right text-white font-semibold tabular-nums whitespace-nowrap">
                {fmtMxn(p.renta ?? p.precio_lista ?? null)}
              </td>
              <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums">
                {fmtDatos(p.datos_gb ?? null)}
              </td>
              <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums hidden xl:table-cell">
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
          className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white leading-snug">
                {p.nombre ?? "—"}
              </p>
              {p.clave && (
                <p className="font-mono text-[10px] text-cyan-300 mt-0.5">
                  {p.clave}
                </p>
              )}
            </div>
            <p className="text-lg font-black text-white tabular-nums shrink-0">
              {fmtMxn(p.renta ?? p.precio_lista ?? null)}
            </p>
          </div>
          <dl className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-[10px] text-slate-500 uppercase tracking-wider">Modalidad</dt>
              <dd className="text-slate-200 mt-0.5">{p.modalidad ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500 uppercase tracking-wider">Plazo</dt>
              <dd className="text-slate-200 mt-0.5">
                {fmtPlazo(p.plazo ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500 uppercase tracking-wider">Datos</dt>
              <dd className="text-slate-200 tabular-nums mt-0.5">
                {fmtDatos(p.datos_gb ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500 uppercase tracking-wider">Minutos</dt>
              <dd className="text-slate-200 tabular-nums mt-0.5">
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
    <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
      <span>
        <strong className="text-white tabular-nums">{showing}</strong> de{" "}
        <strong className="text-white tabular-nums">{total}</strong> {unit}
      </span>
      {totalPages > 1 && (
        <span className="text-slate-500">
          Página{" "}
          <span className="tabular-nums text-slate-300">
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
      className="flex items-center justify-between text-sm text-slate-400 flex-wrap gap-3 pt-2"
    >
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="px-3 py-1.5 border border-white/10 bg-white/5 text-slate-200 rounded-lg hover:bg-white/10 hover:border-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10"
      >
        ← Anterior
      </button>
      <span className="text-slate-500 text-xs">
        Página{" "}
        <span className="tabular-nums text-slate-300">
          {page + 1} de {totalPages}
        </span>
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="px-3 py-1.5 border border-white/10 bg-white/5 text-slate-200 rounded-lg hover:bg-white/10 hover:border-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10"
      >
        Siguiente →
      </button>
    </nav>
  );
}

function UnavailableBanner() {
  return (
    <div className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-amber-400/30 p-6 text-center">
      <p className="inline-block bg-amber-400/15 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1">
        Catálogo cargando
      </p>
      <p className="mt-3 text-sm text-slate-300">
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
      className="rounded-xl border border-red-400/30 bg-red-500/10 backdrop-blur-[12px] p-4 flex items-center justify-between gap-3 flex-wrap"
    >
      <p className="text-red-200 text-sm font-medium">{message}</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 bg-red-500/30 border border-red-400/40 text-red-100 text-sm font-medium rounded-lg hover:bg-red-500/40 transition"
      >
        Reintentar
      </button>
    </div>
  );
}

function EmptyMessage({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-10 text-center text-slate-400 text-sm">
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
          className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-5 space-y-3"
          aria-hidden="true"
        >
          <div className="h-3 bg-white/5 rounded animate-pulse w-1/3" />
          <div className="h-5 bg-white/5 rounded animate-pulse w-3/4" />
          <div className="h-8 bg-white/5 rounded animate-pulse w-full mt-4" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div
      className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-6 space-y-3"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando planes…</span>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-10 bg-white/5 rounded animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
