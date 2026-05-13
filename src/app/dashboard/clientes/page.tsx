"use client";

/**
 * /dashboard/clientes — listing de la cartera del DAT.
 *
 * Por qué Client Component: necesitamos refetch on demand ("Refrescar")
 * y filtrado client-side reactivo. El payload completo es chico
 * (≤ pocos cientos de RFCs) — caben todos en memoria sin paginar.
 *
 * A11Y (audit A2 + B1):
 *  - Cada card es un <Link> (no <tr onClick>), navegable con teclado.
 *  - No anidamos <button> dentro de un elemento clickeable: el CTA
 *    "Cotizar" sale del card y va abajo como Link separado para no
 *    pelearse con el target principal.
 *  - Grid en lugar de tabla con scroll horizontal en mobile.
 *
 * El backend (api/v1/clientes) sólo trae `rfc` + `nombre` hoy. Los KPIs
 * por cliente (# cotizaciones, monto acumulado, último contacto) requieren
 * extender el endpoint upstream — no inventamos números.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardNav } from "../_nav";

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
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="clientes" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Clientes
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
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
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-white transition disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Refrescar"}
          </button>
        </div>

        {/* Buscador */}
        <div className="mb-6">
          <label htmlFor="cliente-q" className="sr-only">
            Buscar cliente por RFC o nombre
          </label>
          <div className="relative max-w-lg">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              aria-hidden="true"
            >
              <SearchIcon className="w-5 h-5" />
            </span>
            <input
              id="cliente-q"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por RFC o nombre…"
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
          >
            <p className="text-red-800 text-sm font-medium">{error}</p>
            <button
              onClick={() => void loadClientes()}
              className="px-3 py-1.5 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 transition"
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
            {filtered.map((c) => (
              <li key={c.rfc}>
                <ClienteCard c={c} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  );
}

/* ---------- Card ---------- */

function ClienteCard({ c }: { c: Cliente }) {
  return (
    <Link
      href={`/dashboard/cliente/${encodeURIComponent(c.rfc)}`}
      className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-400 hover:shadow-sm transition focus-visible:border-blue-400 focus-visible:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 font-semibold flex items-center justify-center text-sm shrink-0"
        >
          {initials(c.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 truncate" title={c.nombre}>
            {c.nombre}
          </p>
          <p className="font-mono text-xs text-slate-600 mt-0.5">{c.rfc}</p>
        </div>
      </div>

      {/* Stats: solo cuando el backend las expone. Si no, ocultamos toda
          la grid para no mostrar "—" repetidos que hacen ver el card vacío. */}
      {(c.cotizaciones !== undefined ||
        c.monto_total !== undefined ||
        c.ultimo_contacto !== undefined) && (
        <dl className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-slate-500">Cotizaciones</dt>
            <dd className="text-slate-900 font-semibold tabular-nums mt-0.5">
              {c.cotizaciones ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Monto</dt>
            <dd className="text-slate-900 font-semibold tabular-nums mt-0.5">
              {fmtMxn(c.monto_total)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Último</dt>
            <dd className="text-slate-900 font-semibold tabular-nums mt-0.5">
              {fmtFecha(c.ultimo_contacto)}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-blue-700 font-medium">
        <span>Ver detalle</span>
        <span aria-hidden="true">→</span>
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
          className="bg-white rounded-xl border border-slate-200 p-5"
          aria-hidden="true"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-100 animate-pulse" />
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
    <div className="bg-white rounded-2xl border border-slate-200 p-10 md:p-14 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
        <UsersEmptyIcon className="w-8 h-8 text-slate-400" />
      </div>
      {reason === "empty" ? (
        <>
          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Aún no tienes clientes en cartera
          </h2>
          <p className="mt-2 text-slate-600 max-w-md mx-auto text-sm leading-relaxed">
            Cuando agregues uno desde el portal Telcel aparecerá aquí
            automáticamente. Mientras tanto puedes cotizar sin base.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/cotizar"
              className="px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition shadow-md inline-flex items-center gap-2"
            >
              Cotizar sin RFC <span aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Sin resultados
          </h2>
          <p className="mt-2 text-slate-600 max-w-md mx-auto text-sm">
            Ningún cliente coincide con{" "}
            <span className="font-mono text-slate-800">
              &ldquo;{query}&rdquo;
            </span>
            .
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- Iconos inline (Heroicons outline) ---------- */

function SearchIcon({ className = "w-5 h-5" }: { className?: string }) {
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
