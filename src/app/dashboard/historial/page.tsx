/**
 * /dashboard/historial — Server Component que lista las cotizaciones del DAT.
 *
 * Por qué Server Component: la página es fundamentalmente lectura de un
 * recurso server-side, sin estado interactivo más allá de filtros. Los
 * filtros se modelan como query params (`?estado=`, `?from=`, `?to=`,
 * `?rfc=`, `?offset=`) para que sea bookmarkable y se pueda renderizar SSR
 * sin spinner en el primer paint.
 *
 * Auth: `getSession()` redirige a /login si no hay sesión válida, así que
 * el handler nunca tiene que defenderse contra session=null.
 *
 * Layout responsive (B1/B9): tabla en md+ con todas las columnas; en mobile
 * mostramos cards stacked con folio + monto destacados + acciones abajo
 * (sin scroll horizontal forzado). El RFC y filtros se mantienen mono para
 * que el DAT los pueda copiar/pegar tal cual.
 */

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listarCotizaciones, maskRfc } from "@/lib/cotizaciones";
import type { Cotizacion, EstadoCotizacion } from "@/types/cotizacion";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { DashboardNav } from "../_nav";

const PAGE_SIZE = 25;

interface PageProps {
  // Next 16: searchParams es Promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickString(value: string | string[] | undefined): string | undefined {
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

function fmtMxn(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function HistorialPage({ searchParams }: PageProps) {
  const session = await getSession();
  const sp = await searchParams;

  const estadoRaw = pickString(sp.estado);
  const fromRaw = pickString(sp.from);
  const toRaw = pickString(sp.to);
  const rfcRaw = pickString(sp.rfc)?.trim().toUpperCase();
  const offsetRaw = pickString(sp.offset);

  const estado = isEstado(estadoRaw) ? estadoRaw : undefined;
  const from = isIsoDate(fromRaw) ? fromRaw : undefined;
  const to = isIsoDate(toRaw) ? toRaw : undefined;
  const rfcFilter = rfcRaw && rfcRaw.length >= 3 ? rfcRaw : undefined;
  const offset = Math.max(0, Number(offsetRaw) || 0);

  const result = await listarCotizaciones(session.tenant_id, {
    limit: PAGE_SIZE,
    offset,
    estado,
    from,
    to,
  });

  // El backend no expone filtro por rfc aún (ver cliente/[rfc]/page.tsx).
  // Mientras tanto filtramos en server después de fetch — sólo afecta a la
  // página actual; el `total` mostrado en paginación corresponde al backend
  // sin filtro de rfc para evitar mentir sobre el conteo global.
  const rowsAll = result.ok ? result.data.cotizaciones : [];
  const rows = rfcFilter
    ? rowsAll.filter((c) => (c.rfc ?? "").toUpperCase().includes(rfcFilter))
    : rowsAll;
  const totalForPagination = result.ok ? result.data.total : 0;
  const filtersActive = Boolean(estado || from || to || rfcFilter);

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="historial" />

      <Section bg="slate" spacing="sm" width="wide">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Historial de cotizaciones
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              Todas las cotizaciones que has generado desde web o Telegram.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/cotizaciones/export?format=xlsx"
              className="text-sm text-blue-700 font-medium hover:underline inline-flex items-center gap-1.5"
              title="Descarga todas las cotizaciones del periodo seleccionado en Excel"
            >
              <DownloadIcon className="w-4 h-4" />
              Exportar Excel
            </a>
            <Link
              href="/dashboard/cotizar"
              className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition shadow-md"
            >
              Nueva cotización
            </Link>
          </div>
        </div>

        <Filtros estado={estado} from={from} to={to} rfc={rfcFilter} />

        {!result.ok ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-900 font-semibold">
              No pudimos cargar el historial.
            </p>
            <p className="text-sm text-red-800 mt-1">{result.message}</p>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState filtered={filtersActive} />
        ) : (
          <>
            <TablaDesktop rows={rows} />
            <CardsMobile rows={rows} />
            {totalForPagination > PAGE_SIZE && (
              <Paginacion
                total={totalForPagination}
                offset={offset}
                estado={estado}
                from={from}
                to={to}
                rfc={rfcFilter}
              />
            )}
          </>
        )}
      </Section>
    </main>
  );
}

/* ---------- Filtros ---------- */

function Filtros({
  estado,
  from,
  to,
  rfc,
}: {
  estado?: EstadoCotizacion;
  from?: string;
  to?: string;
  rfc?: string;
}) {
  // GET form para que los filtros queden en la URL y sean bookmarkables.
  // grid-cols-1 md:grid-cols-2 lg:grid-cols-5 — el 4-col anterior se rompía
  // en 640px (B8 audit).
  return (
    <form
      method="GET"
      className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
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
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          <option value="completada">Completada</option>
          <option value="pendiente">Pendiente</option>
          <option value="fallida">Fallida</option>
        </select>
      </div>
      <div>
        <label
          htmlFor="rfc"
          className="block text-xs font-medium text-slate-600 mb-1"
        >
          RFC
        </label>
        <input
          id="rfc"
          name="rfc"
          type="text"
          inputMode="text"
          autoComplete="off"
          defaultValue={rfc || ""}
          placeholder="ABC123456XYZ"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500 placeholder:font-sans placeholder:normal-case"
        />
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
          className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition flex-1 md:flex-none"
        >
          Aplicar
        </button>
        <Link
          href="/dashboard/historial"
          className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 inline-flex items-center"
        >
          Limpiar
        </Link>
      </div>
    </form>
  );
}

/* ---------- Estado pill ---------- */

function EstadoBadge({ estado }: { estado: EstadoCotizacion }) {
  if (estado === "completada") {
    return (
      <Badge variant="primary" size="sm" uppercase={false}>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
        Completada
      </Badge>
    );
  }
  if (estado === "pendiente") {
    return (
      <Badge variant="warning" size="sm" uppercase={false}>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mr-1.5" />
        Pendiente
      </Badge>
    );
  }
  return (
    <span className="inline-flex items-center font-semibold rounded-full bg-red-50 text-red-700 text-[10px] px-2 py-0.5">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
      Falló
    </span>
  );
}

/* ---------- Tabla Desktop ---------- */

function TablaDesktop({ rows }: { rows: Cotizacion[] }) {
  return (
    <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden hidden md:block">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Lista de cotizaciones del distribuidor con folio, fecha, RFC, líneas,
          monto, estatus y acciones de descarga.
        </caption>
        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
          <tr>
            <th scope="col" className="text-left px-4 py-3 font-medium">Folio</th>
            <th scope="col" className="text-left px-4 py-3 font-medium">Fecha</th>
            <th scope="col" className="text-left px-4 py-3 font-medium">RFC</th>
            <th scope="col" className="text-right px-4 py-3 font-medium">Líneas</th>
            <th scope="col" className="text-right px-4 py-3 font-medium">Renta</th>
            <th scope="col" className="text-left px-4 py-3 font-medium">Estatus</th>
            <th scope="col" className="text-right px-4 py-3 font-medium w-24">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <FilaDesktop key={c.id} c={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaDesktop({ c }: { c: Cotizacion }) {
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
    <tr className="border-t border-slate-100 hover:bg-slate-50 transition">
      <td className="px-4 py-3 font-mono text-xs text-slate-900">
        {c.id.length > 12 ? c.id.slice(0, 12) : c.id}
      </td>
      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fechaStr}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-700">
        {maskRfc(c.rfc)}
      </td>
      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
        {c.lineas}
      </td>
      <td className="px-4 py-3 text-right text-slate-900 font-medium tabular-nums">
        {fmtMxn(c.plan)}
      </td>
      <td className="px-4 py-3">
        <EstadoBadge estado={c.estado} />
      </td>
      <td className="px-4 py-3">
        <AccionesRow c={c} align="right" />
      </td>
    </tr>
  );
}

/* ---------- Cards Mobile ---------- */

function CardsMobile({ rows }: { rows: Cotizacion[] }) {
  return (
    <ul className="md:hidden mt-6 space-y-3" aria-label="Cotizaciones">
      {rows.map((c) => (
        <li
          key={c.id}
          className="bg-white rounded-xl border border-slate-200 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-slate-500 truncate">
                #{c.id.length > 12 ? c.id.slice(0, 12) : c.id}
              </p>
              <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                {fmtMxn(c.plan)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {c.lineas} {c.lineas === 1 ? "línea" : "líneas"} ·{" "}
                {new Date(c.created_at).toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="font-mono text-xs text-slate-600 mt-1">
                {maskRfc(c.rfc)}
              </p>
            </div>
            <EstadoBadge estado={c.estado} />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <AccionesRow c={c} align="left" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Acciones (iconos descarga / retry) ---------- */

function AccionesRow({
  c,
  align,
}: {
  c: Cotizacion;
  align: "left" | "right";
}) {
  const justify = align === "right" ? "justify-end" : "justify-start";

  if (c.estado === "pendiente") {
    return (
      <div className={`flex items-center gap-2 ${justify}`}>
        <span className="text-xs text-slate-500 italic">En proceso…</span>
      </div>
    );
  }

  if (c.estado === "fallida") {
    return (
      <div className={`flex items-center gap-2 ${justify}`}>
        <Link
          href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
          className="text-xs font-medium text-amber-800 hover:underline inline-flex items-center gap-1"
        >
          <RetryIcon className="w-4 h-4" />
          Reintentar
        </Link>
      </div>
    );
  }

  // completada
  const hasCliente = Boolean(c.pdf_url);
  const hasInterno = Boolean(c.pdf_url_interno);

  return (
    <div className={`flex items-center gap-1 ${justify}`}>
      <IconLinkOrDisabled
        href={c.pdf_url}
        enabled={hasCliente}
        label="Descargar PDF cliente"
      />
      <IconLinkOrDisabled
        href={c.pdf_url_interno}
        enabled={hasInterno}
        label="Descargar PDF interno"
        variant="interno"
      />
    </div>
  );
}

function IconLinkOrDisabled({
  href,
  enabled,
  label,
  variant = "cliente",
}: {
  href?: string;
  enabled: boolean;
  label: string;
  variant?: "cliente" | "interno";
}) {
  const base =
    "inline-flex items-center justify-center w-9 h-9 rounded-lg transition";
  const color =
    variant === "interno" ? "text-slate-700" : "text-blue-700";

  if (!enabled || !href) {
    return (
      <span
        className={`${base} text-slate-400 opacity-40 cursor-not-allowed`}
        aria-label={`${label} (no disponible)`}
        title={`${label} (no disponible)`}
      >
        <DownloadIcon className="w-5 h-5" />
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${color} hover:bg-blue-50 focus-visible:bg-blue-50`}
      aria-label={label}
      title={label}
    >
      <DownloadIcon className="w-5 h-5" />
    </a>
  );
}

/* ---------- Empty State ---------- */

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-10 md:p-14 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
        <FolderEmptyIcon className="w-8 h-8 text-slate-400" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-900">
        {filtered
          ? "Sin cotizaciones que coincidan"
          : "Aún no tienes cotizaciones"}
      </h2>
      <p className="mt-2 text-slate-600 max-w-md mx-auto text-sm leading-relaxed">
        {filtered
          ? "Ajusta los filtros o limpia la búsqueda para ver todas tus cotizaciones."
          : "Genera tu primera cotización en menos de un minuto. El PDF queda guardado aquí cuando termine."}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/dashboard/cotizar"
          className="px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition shadow-md inline-flex items-center gap-2"
        >
          Empieza una nueva
          <span aria-hidden="true">→</span>
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

/* ---------- Paginación ---------- */

function Paginacion({
  total,
  offset,
  estado,
  from,
  to,
  rfc,
}: {
  total: number;
  offset: number;
  estado?: EstadoCotizacion;
  from?: string;
  to?: string;
  rfc?: string;
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
    if (rfc) qs.set("rfc", rfc);
    if (o > 0) qs.set("offset", String(o));
    const q = qs.toString();
    return `/dashboard/historial${q ? `?${q}` : ""}`;
  }

  return (
    <nav
      aria-label="Paginación"
      className="mt-4 flex items-center justify-between text-sm text-slate-600 flex-wrap gap-3"
    >
      <span>
        Mostrando <strong className="text-slate-900">{start}</strong>–
        <strong className="text-slate-900">{end}</strong> de{" "}
        <strong className="text-slate-900">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(prevOffset)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white transition"
          >
            ← Anterior
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500">
            ← Anterior
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(nextOffset)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white transition"
          >
            Siguiente →
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500">
            Siguiente →
          </span>
        )}
      </div>
    </nav>
  );
}

/* ---------- Iconos inline (Heroicons outline, stroke 1.5) ---------- */

function DownloadIcon({ className = "w-5 h-5" }: { className?: string }) {
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
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function RetryIcon({ className = "w-5 h-5" }: { className?: string }) {
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
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function FolderEmptyIcon({ className = "w-8 h-8" }: { className?: string }) {
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
        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"
      />
    </svg>
  );
}
