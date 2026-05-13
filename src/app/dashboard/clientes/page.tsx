"use client";

/**
 * /dashboard/clientes — listing de la cartera del DAT.
 *
 * Por qué Client Component: necesitamos refetch on demand ("Refrescar")
 * y filtrado client-side reactivo. El payload completo es chico
 * (≤ pocos cientos de RFCs) — caben todos en memoria sin paginar.
 *
 * REDISEÑO "REVENTAR mode" — dark glassmorphism premium. Hooks y data
 * fetching INTACTOS; solo capa visual.
 *
 * A11Y (audit A2 + B1):
 *  - Cada card es un <Link> (no <tr onClick>), navegable con teclado.
 *  - Grid en lugar de tabla con scroll horizontal en mobile.
 *
 * El backend (api/v1/clientes) sólo trae `rfc` + `nombre` hoy. Los KPIs
 * por cliente (# cotizaciones, monto acumulado, último contacto) requieren
 * extender el endpoint upstream — no inventamos números.
 */

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Sidebar } from "@/components/admin/Sidebar";

type Cliente = {
  rfc: string;
  nombre: string;
  // Campos opcionales por si el backend los expone en el futuro — la UI
  // se adapta sin tener que cambiar el shape del state.
  cotizaciones?: number;
  monto_total?: number;
  ultimo_contacto?: string;
  [key: string]: unknown;
};

type ClientesResponse = {
  clientes: Cliente[];
  total: number;
  fecha_actualizacion: string;
};

function fmtMxn(n: number | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtFecha(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [fechaActualizacion, setFechaActualizacion] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const searchId = useId();
  const errorId = useId();

  const loadClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clientes");
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      const data: ClientesResponse = await res.json();
      setClientes(data.clientes ?? []);
      setTotal(data.total ?? 0);
      setFechaActualizacion(data.fecha_actualizacion ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClientes();
  }, [loadClientes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.rfc.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q)
    );
  }, [clientes, query]);

  return (
    <div className="min-h-screen bg-[#0b1326] text-slate-200 antialiased">
      <Sidebar active="clientes" />

      <main className="relative lg:ml-64 pt-14 lg:pt-0 min-h-screen overflow-hidden">
        {/* Mesh + grid (mismo lenguaje que /dashboard). */}
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
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Link href="/dashboard" className="hover:text-white transition">
                Inicio
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-white">Mis clientes</span>
            </div>
          </div>

          {/* H1 + refrescar */}
          <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                Mis clientes
              </h1>
              <p className="mt-3 text-sm md:text-base text-slate-400 max-w-2xl">
                {total > 0
                  ? `${total} ${total === 1 ? "cliente" : "clientes"} en tu cartera.`
                  : "Tu cartera de clientes Telcel."}
                {fechaActualizacion && (
                  <span className="ml-1 text-slate-500">
                    · Actualizado {fmtFecha(fechaActualizacion)}.
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => void loadClientes()}
              disabled={loading}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 border border-white/10 bg-white/5 text-slate-200 text-sm font-medium rounded-lg hover:bg-white/10 hover:border-white/20 transition disabled:opacity-50"
            >
              <RefreshIcon className="w-4 h-4" />
              {loading ? "Cargando…" : "Refrescar"}
            </button>
          </header>

          {/* Buscador pill */}
          <div className="mb-6">
            <label htmlFor={searchId} className="sr-only">
              Buscar cliente por RFC o nombre
            </label>
            <div className="relative max-w-xl">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                aria-hidden="true"
              >
                <SearchIcon className="w-4 h-4" />
              </span>
              <input
                id={searchId}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por RFC o nombre…"
                className="w-full pl-11 pr-4 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition"
              />
            </div>
          </div>

          {error && (
            <div
              id={errorId}
              role="alert"
              className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 backdrop-blur-[12px] p-4 flex items-center justify-between gap-3 flex-wrap"
            >
              <p className="text-red-200 text-sm font-medium">{error}</p>
              <button
                onClick={() => void loadClientes()}
                className="px-3 py-1.5 bg-red-500/30 border border-red-400/40 text-red-100 text-sm font-medium rounded-lg hover:bg-red-500/40 transition"
              >
                Reintentar
              </button>
            </div>
          )}

          {loading ? (
            <SkeletonGrid />
          ) : !error && clientes.length === 0 ? (
            <EmptyState reason="empty" />
          ) : !error && filtered.length === 0 ? (
            <EmptyState reason="no-match" query={query} />
          ) : !error ? (
            <ul
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              aria-label="Clientes"
              aria-describedby={error ? errorId : undefined}
            >
              {filtered.map((c) => (
                <li key={c.rfc}>
                  <ClienteCard c={c} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/* ---------- Card glassmorphism ---------- */

function ClienteCard({ c }: { c: Cliente }) {
  const hasStats =
    c.cotizaciones !== undefined ||
    c.monto_total !== undefined ||
    c.ultimo_contacto !== undefined;

  return (
    <Link
      href={`/dashboard/cliente/${encodeURIComponent(c.rfc)}`}
      className="group relative block rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-5 transition-all duration-300 hover:scale-[1.02] hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] focus-visible:outline-none focus-visible:border-cyan-400/60 focus-visible:shadow-[0_0_30px_rgba(6,182,212,0.35)]"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="w-12 h-12 rounded-full bg-cyan-400/20 text-cyan-200 font-black flex items-center justify-center text-sm shrink-0 border border-cyan-400/30 shadow-[0_0_18px_rgba(34,211,238,0.15)] group-hover:shadow-[0_0_24px_rgba(34,211,238,0.35)] transition-shadow"
        >
          {initials(c.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="font-bold text-white truncate text-base leading-tight"
            title={c.nombre}
          >
            {c.nombre}
          </p>
          <p className="font-mono text-xs text-cyan-300 mt-1">{c.rfc}</p>
        </div>
      </div>

      {/* Stats: solo cuando el backend las expone. */}
      {hasStats && (
        <dl className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-[10px] text-slate-500 uppercase tracking-wider">
              Cotizaciones
            </dt>
            <dd className="text-white font-bold tabular-nums mt-0.5">
              {c.cotizaciones ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-500 uppercase tracking-wider">
              Monto
            </dt>
            <dd className="text-white font-bold tabular-nums mt-0.5">
              {fmtMxn(c.monto_total)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-500 uppercase tracking-wider">
              Último
            </dt>
            <dd className="text-white font-bold tabular-nums mt-0.5">
              {fmtFecha(c.ultimo_contacto)}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-4 flex items-center justify-between text-xs font-bold text-cyan-300">
        <span>Ver detalle</span>
        <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

/* ---------- Skeleton ---------- */

function SkeletonGrid() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando clientes…</span>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-5"
          aria-hidden="true"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Empty ---------- */

function EmptyState({
  reason,
  query,
}: {
  reason: "empty" | "no-match";
  query?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-10 md:p-14 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
        <UsersEmptyIcon className="w-8 h-8 text-cyan-300" />
      </div>
      {reason === "empty" ? (
        <>
          <h2 className="mt-5 text-xl font-bold text-white">
            Aún no tienes clientes en cartera
          </h2>
          <p className="mt-2 text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
            Cuando agregues uno desde el portal Telcel aparecerá aquí
            automáticamente. Mientras tanto puedes cotizar sin base.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/cotizar"
              className="px-5 py-2.5 bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_30px_rgba(29,78,216,0.5)] transition inline-flex items-center gap-2"
            >
              Cotizar sin RFC <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-5 text-xl font-bold text-white">
            Sin resultados
          </h2>
          <p className="mt-2 text-slate-400 max-w-md mx-auto text-sm">
            Ningún cliente coincide con{" "}
            <span className="font-mono text-cyan-300">
              &ldquo;{query}&rdquo;
            </span>
            .
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- Iconos ---------- */

function SearchIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

function UsersEmptyIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
      />
    </svg>
  );
}

function RefreshIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m-5.082-3.78a8.25 8.25 0 0114.69-1.945M21.183 12.91a8.25 8.25 0 01-14.69 1.945"
      />
    </svg>
  );
}

function ArrowRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
      />
    </svg>
  );
}
