/**
 * /dashboard/historial — Server Component que lista las cotizaciones del DAT.
 *
 * REDISEÑO LUMINA Light Premium (pivot definitivo desde dark glassmorphism).
 *
 *  - Surface bg-slate-50 + cards bg-white rounded-2xl shadow-sm.
 *  - Primario INDIGO #4F46E5, accent CYAN #06B6D4, pop PINK #EC4899.
 *  - Pills rounded-full en filtros + outline "Exportar Excel".
 *  - Tabla desktop con motion.tr hover bg-indigo-50/30; cards mobile con
 *    motion.div whileHover.
 *  - Empty state SVG ilustración + CTA indigo.
 *
 * Server Component: la página es lectura pura del listing del DAT. Los
 * filtros son query params (?estado=, ?from=, ?to=, ?rfc=, ?offset=) para
 * bookmarkability + SSR sin spinner. Los pedacitos interactivos (hover de
 * fila / hover de card / empty illustration motion) son Client Components
 * pequeños — el data fetching sigue siendo server.
 *
 * Hooks y fetching INTACTOS.
 */

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listarCotizaciones, maskRfc } from "@/lib/cotizaciones";
import type { Cotizacion, EstadoCotizacion } from "@/types/cotizacion";
import { Sidebar } from "@/components/admin/Sidebar";
import {
  Download,
  RotateCw,
  Image as ImageIcon,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Inbox,
  FileText,
} from "lucide-react";
import { MotionRow, MotionCard, MotionEmpty } from "./_motion";

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

  // El backend no expone filtro por rfc aún. Filtramos en server después
  // de fetch — sólo afecta a la página actual; el `total` mostrado en
  // paginación corresponde al backend sin filtro de rfc para no mentir.
  const rowsAll = result.ok ? result.data.cotizaciones : [];
  const rows = rfcFilter
    ? rowsAll.filter((c) => (c.rfc ?? "").toUpperCase().includes(rfcFilter))
    : rowsAll;
  const totalForPagination = result.ok ? result.data.total : 0;
  const filtersActive = Boolean(estado || from || to || rfcFilter);

  // Sidebar identity — mismo patrón que /dashboard.
  const initials = String(session.vendedor_id).slice(0, 2).toUpperCase();
  const userLabel = `Vendedor #${session.vendedor_id}`;
  const userSubtitle = `Distribuidor ${session.tenant_id}`;

  // A/B viene del campo real `rentabilidad` por fila — no se necesita montoMax.

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar
        active="historial"
        initials={initials}
        userLabel={userLabel}
        userSubtitle={userSubtitle}
      />

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
            <span className="text-slate-900 font-semibold">Historial</span>
          </div>

          {/* H1 + acciones */}
          <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                Historial de cotizaciones
              </h1>
              <p className="mt-3 text-sm md:text-base text-slate-600 max-w-2xl">
                Todas las cotizaciones que has generado desde web o Telegram.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <a
                href="/api/cotizaciones/export?format=xlsx"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-indigo-200 text-indigo-700 text-sm font-semibold bg-white hover:bg-indigo-50 hover:border-indigo-300 transition"
                title="Descarga todas las cotizaciones del periodo seleccionado en Excel"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </a>
              <Link
                href="/dashboard/cotizar"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition"
              >
                Nueva cotización
              </Link>
            </div>
          </header>

          <Filtros estado={estado} from={from} to={to} rfc={rfcFilter} />

          {!result.ok ? (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6"
            >
              <p className="text-rose-700 font-semibold">
                No pudimos cargar el historial.
              </p>
              <p className="text-sm text-rose-600 mt-1">{result.message}</p>
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
        </div>
      </main>
    </div>
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
  // GET form para que los filtros queden en la URL (bookmarkable / SSR).
  return (
    <form
      method="GET"
      className="mt-2 mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
    >
      <div>
        <label
          htmlFor="estado"
          className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
        >
          Estado
        </label>
        <select
          id="estado"
          name="estado"
          defaultValue={estado || ""}
          className="w-full px-4 py-2 bg-slate-100 border border-transparent rounded-full text-sm text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white transition"
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
          className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
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
          className="w-full px-4 py-2 bg-slate-100 border border-transparent rounded-full text-sm font-mono uppercase text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:normal-case focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white transition"
        />
      </div>
      <div>
        <label
          htmlFor="from"
          className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
        >
          Desde
        </label>
        <input
          id="from"
          name="from"
          type="date"
          defaultValue={from || ""}
          className="w-full px-4 py-2 bg-slate-100 border border-transparent rounded-full text-sm text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white transition"
        />
      </div>
      <div>
        <label
          htmlFor="to"
          className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
        >
          Hasta
        </label>
        <input
          id="to"
          name="to"
          type="date"
          defaultValue={to || ""}
          className="w-full px-4 py-2 bg-slate-100 border border-transparent rounded-full text-sm text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white transition"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 md:flex-none px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition"
        >
          Aplicar
        </button>
        <Link
          href="/dashboard/historial"
          className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition inline-flex items-center"
        >
          Limpiar
        </Link>
      </div>
    </form>
  );
}

/* ---------- Estado chip ---------- */

function EstadoBadge({ estado }: { estado: EstadoCotizacion }) {
  if (estado === "completada") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider whitespace-nowrap">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
        Completada
      </span>
    );
  }
  if (estado === "pendiente") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider whitespace-nowrap">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider whitespace-nowrap">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
      Falló
    </span>
  );
}

/* ---------- Tabla Desktop ---------- */

function TablaDesktop({
  rows,
}: {
  rows: Cotizacion[];
}) {
  return (
    <div className="hidden md:block rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Lista de cotizaciones del distribuidor con folio, fecha, RFC, líneas,
          monto, estatus y acciones de descarga.
        </caption>
        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-widest font-bold border-b border-slate-200">
          <tr>
            <th scope="col" className="text-left px-5 py-3">Folio</th>
            <th scope="col" className="text-left px-5 py-3">Fecha</th>
            <th scope="col" className="text-left px-5 py-3">RFC</th>
            <th scope="col" className="text-left px-5 py-3">Cliente</th>
            <th scope="col" className="text-right px-5 py-3">Líneas</th>
            <th scope="col" className="text-right px-5 py-3">Monto</th>
            <th scope="col" className="text-left px-5 py-3 hidden lg:table-cell">
              A/B
            </th>
            <th scope="col" className="text-left px-5 py-3">Estatus</th>
            <th scope="col" className="text-right px-5 py-3 w-32">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((c, idx) => (
            <FilaDesktop
              key={c.id}
              c={c}
              delayIndex={idx}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaDesktop({
  c,
  delayIndex,
}: {
  c: Cotizacion;
  delayIndex: number;
}) {
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

  // Folio compacto — UUID head en mono cyan-600.
  const folio = c.id.length > 8 ? c.id.slice(0, 8).toUpperCase() : c.id;

  // Monto real.
  const monto = c.lineas * c.plan;

  // A/B real: viene del backend como string "22.5%" o "22.5".
  const abRaw = c.rentabilidad ?? null;
  const abNum = abRaw
    ? parseFloat(abRaw.replace("%", "").replace(",", "."))
    : NaN;
  const abHasValue = abRaw && Number.isFinite(abNum) && abNum >= 0;

  return (
    <MotionRow delayIndex={delayIndex}>
      <td className="px-5 py-3.5 font-mono text-xs text-cyan-600 font-semibold whitespace-nowrap max-w-[8rem] truncate">
        {folio}
      </td>
      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap tabular-nums">
        {fechaStr}
      </td>
      <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
        {maskRfc(c.rfc)}
      </td>
      <td className="px-5 py-3.5 text-slate-900 font-semibold whitespace-nowrap max-w-[14rem] truncate">
        {c.equipo || (
          <span className="text-slate-400 italic font-normal">Sin equipo</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">
        {c.lineas}
      </td>
      <td className="px-5 py-3.5 text-right text-slate-900 font-bold tabular-nums whitespace-nowrap">
        {fmtMxn(monto)}
      </td>
      <td className="px-5 py-3.5 hidden lg:table-cell">
        {abHasValue ? (
          <div className="flex items-center gap-2 w-28">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full"
                style={{ width: `${Math.min(100, abNum * 3)}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="text-[10px] text-slate-500 tabular-nums w-8 text-right font-semibold">
              {abNum.toFixed(1)}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <EstadoBadge estado={c.estado} />
      </td>
      <td className="px-5 py-3.5">
        <AccionesRow c={c} align="right" />
      </td>
    </MotionRow>
  );
}

/* ---------- Cards Mobile ---------- */

function CardsMobile({ rows }: { rows: Cotizacion[] }) {
  return (
    <ul className="md:hidden space-y-3" aria-label="Cotizaciones">
      {rows.map((c, idx) => (
        <li key={c.id}>
          <MotionCard delayIndex={idx}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-cyan-600 font-semibold truncate">
                  {c.id.length > 8 ? c.id.slice(0, 8).toUpperCase() : c.id}
                </p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                  {fmtMxn(c.lineas * c.plan)}
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
          </MotionCard>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Acciones ---------- */

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
        <span className="text-xs text-amber-600 italic">En proceso…</span>
      </div>
    );
  }

  if (c.estado === "fallida") {
    return (
      <div className={`flex items-center gap-2 ${justify}`}>
        <Link
          href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-full hover:bg-slate-100 hover:border-slate-300 transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Reintentar
        </Link>
      </div>
    );
  }

  // completada
  const hasCliente = Boolean(c.pdf_url);
  const hasInterno = Boolean(c.pdf_url_interno);
  const hasScreenshot = Boolean(c.screenshot_url);

  if (!hasCliente && !hasInterno && !hasScreenshot) {
    return (
      <div className={`flex items-center gap-2 ${justify}`}>
        <span className="text-xs text-slate-400">Sin enlace</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${justify}`}>
      <IconLinkOrDisabled
        href={c.pdf_url}
        enabled={hasCliente}
        label="Descargar PDF cliente"
        variant="cliente"
      />
      <IconLinkOrDisabled
        href={c.pdf_url_interno}
        enabled={hasInterno}
        label="Descargar PDF interno"
        variant="interno"
      />
      {/* Borradores (sin RFC): el portal Telcel no emite PDF oficial. El bot
          guarda una captura del resumen como evidencia descargable. Solo
          mostramos este botón si no hay PDF cliente. */}
      {!hasCliente && hasScreenshot && (
        <ScreenshotLink href={c.screenshot_url!} />
      )}
    </div>
  );
}

function ScreenshotLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 hover:border-cyan-300 transition"
      aria-label="Ver captura del resumen (borrador sin PDF)"
      title="Ver captura del resumen (borrador sin PDF)"
    >
      <ImageIcon className="w-4 h-4" />
    </a>
  );
}

function IconLinkOrDisabled({
  href,
  enabled,
  label,
  variant,
}: {
  href?: string;
  enabled: boolean;
  label: string;
  variant: "cliente" | "interno";
}) {
  if (!enabled || !href) {
    return (
      <span
        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-300 opacity-60 cursor-not-allowed border border-slate-100"
        aria-label={`${label} (no disponible)`}
        title={`${label} (no disponible)`}
      >
        <Download className="w-4 h-4" />
      </span>
    );
  }

  const styles =
    variant === "cliente"
      ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300"
      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition ${styles}`}
      aria-label={label}
      title={label}
    >
      <Download className="w-4 h-4" />
    </a>
  );
}

/* ---------- Empty State ---------- */

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <MotionEmpty>
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 md:p-14 text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center ring-8 ring-indigo-50/50">
          {filtered ? (
            <Inbox className="w-10 h-10 text-indigo-500" />
          ) : (
            <FileText className="w-10 h-10 text-indigo-500" />
          )}
        </div>
        <h2 className="mt-6 text-2xl font-extrabold text-slate-900 tracking-tight">
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
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition inline-flex items-center gap-2"
          >
            Empezar nueva
            <ArrowRight className="w-4 h-4" />
          </Link>
          {filtered && (
            <Link
              href="/dashboard/historial"
              className="px-5 py-2.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition"
            >
              Limpiar filtros
            </Link>
          )}
        </div>
      </div>
    </MotionEmpty>
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
      className="mt-5 flex items-center justify-between text-sm text-slate-500 flex-wrap gap-3"
    >
      <span>
        Mostrando{" "}
        <strong className="text-slate-900 tabular-nums">{start}</strong>–
        <strong className="text-slate-900 tabular-nums">{end}</strong> de{" "}
        <strong className="text-slate-900 tabular-nums">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(prevOffset)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-100 text-slate-300">
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(nextOffset)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-100 text-slate-300">
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
