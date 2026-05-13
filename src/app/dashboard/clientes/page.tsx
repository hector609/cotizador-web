"use client";

/**
 * /dashboard/clientes — listing de la cartera del DAT.
 *
 * REDISEÑO LUMINA Light Premium.
 *
 *  - Surface bg-slate-50 + cards bg-white rounded-2xl shadow-sm border-slate-200.
 *  - Avatar circular gradient indigo→cyan con inicial; nombre slate-900 bold,
 *    RFC mono cyan-600 small.
 *  - framer-motion whileHover y:-4 scale:1.02 + hover:border-indigo-200 +
 *    shadow-xl shadow-indigo-100/40.
 *  - Búsqueda input pill bg-slate-100 rounded-full + lucide Search.
 *
 * Client Component porque necesitamos refetch on demand ("Refrescar") y
 * filtrado client-side reactivo. El payload completo es chico (≤ pocos
 * cientos de RFCs) — caben todos en memoria sin paginar.
 *
 * A11Y:
 *   - Cada card es un <Link> (no <tr onClick>), navegable con teclado.
 *   - Grid en lugar de tabla con scroll horizontal en mobile.
 *   - useId + htmlFor + role=alert + aria-describedby en errores.
 *
 * El backend (api/v1/clientes) sólo trae `rfc` + `nombre` hoy. Los KPIs
 * por cliente (# cotizaciones, monto acumulado, último contacto) requieren
 * extender el endpoint upstream — no inventamos números.
 */

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  RotateCw,
  Users as UsersEmpty,
  ArrowRight,
} from "lucide-react";
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
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar active="clientes" />

      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <Link
              href="/dashboard"
              className="hover:text-indigo-600 transition"
            >
              Inicio
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">Mis clientes</span>
          </div>

          {/* H1 + refrescar */}
          <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                Mis clientes
              </h1>
              <p className="mt-3 text-sm md:text-base text-slate-600 max-w-2xl">
                {total > 0
                  ? `${total} ${total === 1 ? "cliente" : "clientes"} en tu cartera.`
                  : "Tu cartera de clientes Telcel."}
                {fechaActualizacion && (
                  <span className="ml-1 text-slate-400">
                    · Actualizado {fmtFecha(fechaActualizacion)}.
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => void loadClientes()}
              disabled={loading}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-50"
            >
              <RotateCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Cargando…" : "Refrescar"}
            </button>
          </header>

          {/* Buscador pill */}
          <div className="mb-6">
            <label htmlFor={searchId} className="sr-only">
              Buscar cliente por RFC o nombre
            </label>
            <div className="relative max-w-xl">
              <Search
                aria-hidden="true"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              />
              <input
                id={searchId}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por RFC o nombre…"
                aria-describedby={error ? errorId : undefined}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-100 border border-transparent rounded-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white transition"
              />
            </div>
          </div>

          {error && (
            <div
              id={errorId}
              role="alert"
              className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-center justify-between gap-3 flex-wrap"
            >
              <p className="text-rose-700 text-sm font-medium">{error}</p>
              <button
                onClick={() => void loadClientes()}
                className="px-3 py-1.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 text-sm font-medium hover:bg-rose-200 transition"
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
            >
              {filtered.map((c, idx) => (
                <li key={c.rfc}>
                  <ClienteCard c={c} delayIndex={idx} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/* ---------- Card LUMINA Light ---------- */

function ClienteCard({ c, delayIndex }: { c: Cliente; delayIndex: number }) {
  const hasStats =
    c.cotizaciones !== undefined ||
    c.monto_total !== undefined ||
    c.ultimo_contacto !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay: Math.min(delayIndex, 12) * 0.03,
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/40 transition-shadow"
    >
      <Link
        href={`/dashboard/cliente/${encodeURIComponent(c.rfc)}`}
        className="group block p-5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 text-white font-extrabold flex items-center justify-center text-sm shrink-0 shadow-sm"
          >
            {initials(c.nombre)}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="font-bold text-slate-900 truncate text-base leading-tight"
              title={c.nombre}
            >
              {c.nombre}
            </p>
            <p className="font-mono text-xs text-cyan-600 font-semibold mt-1">
              {c.rfc}
            </p>
          </div>
        </div>

        {/* Stats: solo cuando el backend las expone. */}
        {hasStats && (
          <dl className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Cotizaciones
              </dt>
              <dd className="text-slate-900 font-bold tabular-nums mt-0.5">
                {c.cotizaciones ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Monto
              </dt>
              <dd className="text-slate-900 font-bold tabular-nums mt-0.5">
                {fmtMxn(c.monto_total)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Último
              </dt>
              <dd className="text-slate-900 font-bold tabular-nums mt-0.5">
                {fmtFecha(c.ultimo_contacto)}
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600">
          <span>Ver detalle</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    </motion.div>
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
          className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5"
          aria-hidden="true"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 md:p-14 text-center"
    >
      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center ring-8 ring-indigo-50/50">
        <UsersEmpty className="w-10 h-10 text-indigo-500" />
      </div>
      {reason === "empty" ? (
        <>
          <h2 className="mt-6 text-2xl font-extrabold text-slate-900 tracking-tight">
            Aún no tienes clientes en cartera
          </h2>
          <p className="mt-2 text-slate-600 max-w-md mx-auto text-sm leading-relaxed">
            Cuando agregues uno desde el portal Telcel aparecerá aquí
            automáticamente. Mientras tanto puedes cotizar sin base.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/cotizar"
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition inline-flex items-center gap-2"
            >
              Cotizar sin RFC <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-6 text-2xl font-extrabold text-slate-900 tracking-tight">
            Sin resultados
          </h2>
          <p className="mt-2 text-slate-600 max-w-md mx-auto text-sm">
            Ningún cliente coincide con{" "}
            <span className="font-mono text-cyan-600 font-semibold">
              &ldquo;{query}&rdquo;
            </span>
            .
          </p>
        </>
      )}
    </motion.div>
  );
}
