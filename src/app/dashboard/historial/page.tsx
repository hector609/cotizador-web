/**
 * /dashboard/historial — Server Component que lista las cotizaciones del DAT.
 *
 * Por qué Server Component: la página es fundamentalmente lectura de un
 * recurso server-side, sin estado interactivo más allá de filtros. Los
 * filtros se modelan como query params (`?estado=`, `?from=`, `?to=`,
 * `?offset=`) para que sea bookmarkable y se pueda renderizar SSR sin
 * spinner en el primer paint.
 *
 * Auth: `getSession()` redirige a /login si no hay sesión válida, así que
 * el handler nunca tiene que defenderse contra session=null.
 *
 * Acciones por fila (descargar PDF, reintentar) son <a> y <form> nativos —
 * no necesitamos JS de cliente. Si en el futuro queremos toasts o
 * confirm-dialog, podemos extraer un Client Component dedicado.
 */

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listarCotizaciones, maskRfc } from "@/lib/cotizaciones";
import type {
  Cotizacion,
  EstadoCotizacion,
} from "@/types/cotizacion";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { DashboardNav } from "../_nav";

const PAGE_SIZE = 20;

interface PageProps {
  // Next 16: searchParams es Promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickString(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isEstado(v: string | undefined): v is EstadoCotizacion {
  return v === "pendiente" || v === "completada" || v === "fallida";
}

// YYYY-MM-DD básico — el backend hace la validación real.
function isIsoDate(v: string | undefined): v is string {
  return Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
}

export default async function HistorialPage({ searchParams }: PageProps) {
  const session = await getSession();
  const sp = await searchParams;

  const estadoRaw = pickString(sp.estado);
  const fromRaw = pickString(sp.from);
  const toRaw = pickString(sp.to);
  const offsetRaw = pickString(sp.offset);

  const estado = isEstado(estadoRaw) ? estadoRaw : undefined;
  const from = isIsoDate(fromRaw) ? fromRaw : undefined;
  const to = isIsoDate(toRaw) ? toRaw : undefined;
  const offset = Math.max(0, Number(offsetRaw) || 0);

  const result = await listarCotizaciones(session.tenant_id, {
    limit: PAGE_SIZE,
    offset,
    estado,
    from,
    to,
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="historial" />

      <Section bg="slate" spacing="sm" width="wide">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              Historial de cotizaciones
            </h2>
            <p className="text-slate-600 mt-1">
              Todas las cotizaciones que has generado desde web o Telegram.
            </p>
          </div>
          <Link
            href="/dashboard/cotizar"
            className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
          >
            Nueva cotización
          </Link>
        </div>

        <Filtros estado={estado} from={from} to={to} />

        {!result.ok ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-900 font-semibold">
              No pudimos cargar el historial.
            </p>
            <p className="text-sm text-red-800 mt-1">{result.message}</p>
          </div>
        ) : result.data.cotizaciones.length === 0 ? (
          <EmptyState
            filtered={Boolean(estado || from || to)}
          />
        ) : (
          <>
            <Tabla rows={result.data.cotizaciones} />
            <Paginacion
              total={result.data.total}
              offset={offset}
              estado={estado}
              from={from}
              to={to}
            />
          </>
        )}
      </Section>
    </main>
  );
}

/* ---------- subcomponents ---------- */

function Filtros({
  estado,
  from,
  to,
}: {
  estado?: EstadoCotizacion;
  from?: string;
  to?: string;
}) {
  // GET form para que los filtros queden en la URL y sean bookmarkables.
  return (
    <form
      method="GET"
      className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
    >
      <div>
        <label
          htmlFor="estado"
          className="block text-xs font-medium text-slate-600 mb-1"
        >
          Estado
        </label>
        <select
          id="estado"
          name="estado"
          defaultValue={estado || ""}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          <option value="completada">Completada</option>
          <option value="pendiente">Pendiente</option>
          <option value="fallida">Fallida</option>
        </select>
      </div>
      <div>
        <label
          htmlFor="from"
          className="block text-xs font-medium text-slate-600 mb-1"
        >
          Desde
        </label>
        <input
          id="from"
          name="from"
          type="date"
          defaultValue={from || ""}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label
          htmlFor="to"
          className="block text-xs font-medium text-slate-600 mb-1"
        >
          Hasta
        </label>
        <input
          id="to"
          name="to"
          type="date"
          defaultValue={to || ""}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
        >
          Aplicar
        </button>
        <Link
          href="/dashboard/historial"
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Limpiar
        </Link>
      </div>
    </form>
  );
}

function Tabla({ rows }: { rows: Cotizacion[] }) {
  return (
    <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Cliente</th>
              <th className="text-right px-4 py-3 font-medium">Líneas</th>
              <th className="text-right px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <Fila key={c.id} c={c} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Fila({ c }: { c: Cotizacion }) {
  const fecha = new Date(c.created_at);
  const fechaStr = isNaN(fecha.getTime())
    ? c.created_at
    : fecha.toLocaleString("es-MX", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fechaStr}</td>
      <td className="px-4 py-3 font-mono text-slate-900">{maskRfc(c.rfc)}</td>
      <td className="px-4 py-3 text-right text-slate-700">{c.lineas}</td>
      <td className="px-4 py-3 text-right text-slate-700">
        ${c.plan.toLocaleString("es-MX")}
      </td>
      <td className="px-4 py-3">
        <EstadoPill estado={c.estado} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-2 justify-end">
          {c.estado === "completada" && c.pdf_url && (
            <a
              href={c.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-700 text-white text-xs font-medium rounded-lg hover:bg-blue-800 transition"
            >
              Descargar PDF
            </a>
          )}
          {c.estado === "completada" && (
            // Excel resumen: el backend acepta tanto job_id (uuid hex) como
            // folio Telcel. El campo `id` del DTO es el folio si existe, o un
            // hash sintético si no — en ambos casos el bot lo resuelve.
            <a
              href={`/api/cotizaciones/${encodeURIComponent(c.id)}/excel`}
              download
              className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition"
              title="Descarga un Excel con el resumen de la cotización"
            >
              Descargar Excel
            </a>
          )}
          {c.estado === "fallida" && (
            // Reintentar = ir a /cotizar pre-llenando el RFC.
            <Link
              href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition"
            >
              Reintentar
            </Link>
          )}
          {c.estado === "pendiente" && (
            <span className="text-xs text-slate-500">En proceso…</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function EstadoPill({ estado }: { estado: EstadoCotizacion }) {
  if (estado === "completada") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <span aria-hidden="true">✅</span>
        Completada
      </span>
    );
  }
  if (estado === "pendiente") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <span aria-hidden="true">⏳</span>
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
      <span aria-hidden="true">❌</span>
      Falló
    </span>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-10 md:p-14 text-center">
      <Badge variant="muted" uppercase={false}>
        Vacío
      </Badge>
      <h3 className="mt-4 text-2xl font-bold text-slate-900">
        {filtered
          ? "Sin cotizaciones que coincidan con los filtros"
          : "Aún no tienes cotizaciones"}
      </h3>
      <p className="mt-2 text-slate-600 max-w-md mx-auto">
        {filtered
          ? "Ajusta los filtros o limpia la búsqueda para ver todas tus cotizaciones."
          : "Genera tu primera cotización en menos de un minuto. El PDF queda guardado aquí cuando termine."}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href="/dashboard/cotizar"
          className="px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
        >
          Crear cotización
        </Link>
        {filtered && (
          <Link
            href="/dashboard/historial"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Limpiar filtros
          </Link>
        )}
      </div>
    </div>
  );
}

function Paginacion({
  total,
  offset,
  estado,
  from,
  to,
}: {
  total: number;
  offset: number;
  estado?: EstadoCotizacion;
  from?: string;
  to?: string;
}) {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(total, offset + PAGE_SIZE);
  const prevOffset = Math.max(0, offset - PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < total;

  function buildHref(o: number): string {
    const qs = new URLSearchParams();
    if (estado) qs.set("estado", estado);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (o > 0) qs.set("offset", String(o));
    const q = qs.toString();
    return `/dashboard/historial${q ? `?${q}` : ""}`;
  }

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>
        Mostrando <strong className="text-slate-900">{start}</strong>–
        <strong className="text-slate-900">{end}</strong> de{" "}
        <strong className="text-slate-900">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(prevOffset)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white"
          >
            ← Anterior
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-400">
            ← Anterior
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(nextOffset)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white"
          >
            Siguiente →
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-400">
            Siguiente →
          </span>
        )}
      </div>
    </div>
  );
}
