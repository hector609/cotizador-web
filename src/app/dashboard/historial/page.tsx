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
 * REDISEÑO "REVENTAR mode" (dark glassmorphism premium tipo Linear/Vercel).
 * Hooks y data fetching INTACTOS — solo JSX + Tailwind.
 *
 * Layout responsive (B1/B9): tabla `hidden md:table` con todas las columnas
 * + cards stacked `md:hidden` en mobile.
 */

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listarCotizaciones, maskRfc } from "@/lib/cotizaciones";
import type { Cotizacion, EstadoCotizacion } from "@/types/cotizacion";
import { Sidebar } from "@/components/admin/Sidebar";

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

  // Promedio Ahorro-vs-base (A/B%) — el listing no expone "base" por
  // cotización; usamos un proxy estable: ratio plan vs ticket promedio
  // global. Visualmente es solo una micro-bar — sigue lectura, no decisión.
  const completadas = rows.filter((c) => c.estado === "completada");
  const montos = completadas.map((c) => c.lineas * c.plan).filter((v) => v > 0);
  const montoMax = montos.length > 0 ? Math.max(...montos) : 0;

  return (
    <div className="min-h-screen bg-[#0b1326] text-slate-200 antialiased">
      <Sidebar
        active="historial"
        initials={initials}
        userLabel={userLabel}
        userSubtitle={userSubtitle}
      />

      <main className="relative lg:ml-64 pt-14 lg:pt-0 min-h-screen overflow-hidden">
        {/* Mesh top-right + grid hairline (mismo lenguaje que /dashboard). */}
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
              <span className="text-white">Historial</span>
            </div>
          </div>

          {/* H1 + acciones */}
          <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                Historial de cotizaciones
              </h1>
              <p className="mt-3 text-sm md:text-base text-slate-400 max-w-2xl">
                Todas las cotizaciones que has generado desde web o Telegram.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href="/api/cotizaciones/export?format=xlsx"
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-cyan-400/40 text-cyan-300 text-sm font-semibold rounded-lg hover:bg-cyan-400/10 hover:border-cyan-400/60 transition"
                title="Descarga todas las cotizaciones del periodo seleccionado en Excel"
              >
                <DownloadIcon className="w-4 h-4" />
                Exportar Excel
              </a>
              <Link
                href="/dashboard/cotizar"
                className="px-4 py-2 bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_30px_rgba(29,78,216,0.5)] transition"
              >
                Nueva cotización
              </Link>
            </div>
          </header>

          <Filtros estado={estado} from={from} to={to} rfc={rfcFilter} />

          {!result.ok ? (
            <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 backdrop-blur-[12px] p-6">
              <p className="text-red-200 font-semibold">
                No pudimos cargar el historial.
              </p>
              <p className="text-sm text-red-300/80 mt-1">{result.message}</p>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState filtered={filtersActive} />
          ) : (
            <>
              <TablaDesktop rows={rows} montoMax={montoMax} />
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

/* ---------- Filtros (pills glassmorphism) ---------- */

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
  return (
    <form
      method="GET"
      className="mt-2 mb-6 rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
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
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition"
        >
          <option value="" className="bg-[#0b1326]">Todos</option>
          <option value="completada" className="bg-[#0b1326]">Completada</option>
          <option value="pendiente" className="bg-[#0b1326]">Pendiente</option>
          <option value="fallida" className="bg-[#0b1326]">Fallida</option>
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
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-mono uppercase text-white placeholder:text-slate-500 placeholder:font-sans placeholder:normal-case focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition"
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
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition [color-scheme:dark]"
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
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition [color-scheme:dark]"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 md:flex-none px-4 py-2 bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_18px_rgba(29,78,216,0.25)] hover:shadow-[0_0_28px_rgba(29,78,216,0.45)] transition"
        >
          Aplicar
        </button>
        <Link
          href="/dashboard/historial"
          className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition inline-flex items-center"
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
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider whitespace-nowrap">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        Completada
      </span>
    );
  }
  if (estado === "pendiente") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30 uppercase tracking-wider whitespace-nowrap">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-400/10 text-red-300 border border-red-400/30 uppercase tracking-wider whitespace-nowrap">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 shadow-[0_0_6px_rgba(248,113,113,0.8)]" />
      Falló
    </span>
  );
}

/* ---------- Tabla Desktop ---------- */

function TablaDesktop({
  rows,
  montoMax,
}: {
  rows: Cotizacion[];
  montoMax: number;
}) {
  return (
    <div className="hidden md:block rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Lista de cotizaciones del distribuidor con folio, fecha, RFC, líneas,
          monto, estatus y acciones de descarga.
        </caption>
        <thead className="bg-white/[0.02] text-slate-500 uppercase text-[10px] tracking-widest font-bold border-b border-white/10">
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
        <tbody className="divide-y divide-white/5">
          {rows.map((c) => (
            <FilaDesktop key={c.id} c={c} montoMax={montoMax} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaDesktop({
  c,
  montoMax,
}: {
  c: Cotizacion;
  montoMax: number;
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

  // Folio compacto — UUID head en mono cyan.
  const folio = c.id.length > 8 ? c.id.slice(0, 8).toUpperCase() : c.id;

  // Monto y micro-bar A/B (proxy: porcentaje del monto vs máximo de la página).
  const monto = c.lineas * c.plan;
  const ratio =
    c.estado === "completada" && montoMax > 0
      ? Math.max(4, Math.min(100, Math.round((monto / montoMax) * 100)))
      : 0;

  return (
    <tr className="hover:bg-white/[0.03] transition-colors group">
      <td className="px-5 py-3.5 font-mono text-xs text-cyan-300 whitespace-nowrap">
        {folio}
      </td>
      <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap tabular-nums">
        {fechaStr}
      </td>
      <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
        {maskRfc(c.rfc)}
      </td>
      <td className="px-5 py-3.5 text-white font-medium whitespace-nowrap max-w-[14rem] truncate">
        {c.equipo || (
          <span className="text-slate-500 italic font-normal">Sin equipo</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums">
        {c.lineas}
      </td>
      <td className="px-5 py-3.5 text-right text-white font-semibold tabular-nums whitespace-nowrap">
        {fmtMxn(monto)}
      </td>
      <td className="px-5 py-3.5 hidden lg:table-cell">
        {ratio > 0 ? (
          <div className="flex items-center gap-2 w-28">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                style={{ width: `${ratio}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">
              {ratio}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <EstadoBadge estado={c.estado} />
      </td>
      <td className="px-5 py-3.5">
        <AccionesRow c={c} align="right" />
      </td>
    </tr>
  );
}

/* ---------- Cards Mobile ---------- */

function CardsMobile({ rows }: { rows: Cotizacion[] }) {
  return (
    <ul className="md:hidden space-y-3" aria-label="Cotizaciones">
      {rows.map((c) => (
        <li
          key={c.id}
          className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-cyan-300 truncate">
                {c.id.length > 8 ? c.id.slice(0, 8).toUpperCase() : c.id}
              </p>
              <p className="text-2xl font-black text-white tabular-nums mt-1">
                {fmtMxn(c.lineas * c.plan)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {c.lineas} {c.lineas === 1 ? "línea" : "líneas"} ·{" "}
                {new Date(c.created_at).toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="font-mono text-xs text-slate-300 mt-1">
                {maskRfc(c.rfc)}
              </p>
            </div>
            <EstadoBadge estado={c.estado} />
          </div>
          <div className="mt-3 pt-3 border-t border-white/5">
            <AccionesRow c={c} align="left" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Acciones (icon buttons PDF Cliente + PDF Interno) ---------- */

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
        <span className="text-xs text-amber-300 italic">En proceso…</span>
      </div>
    );
  }

  if (c.estado === "fallida") {
    return (
      <div className={`flex items-center gap-2 ${justify}`}>
        <Link
          href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/10 text-slate-200 text-xs font-medium rounded-md hover:bg-white/10 transition"
        >
          <RetryIcon className="w-3.5 h-3.5" />
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
        <span className="text-xs text-slate-500">Sin enlace</span>
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
          mostramos este botón si no hay PDF cliente (cuando hay PDF, el
          screenshot es redundante). */}
      {!hasCliente && hasScreenshot && (
        <ScreenshotLink href={c.screenshot_url!} />
      )}
    </div>
  );
}

function ScreenshotLink({ href }: { href: string }) {
  const base =
    "inline-flex items-center justify-center w-8 h-8 rounded-lg transition";
  const styles =
    "bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/50";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${styles}`}
      aria-label="Ver captura del resumen (borrador sin PDF)"
      title="Ver captura del resumen (borrador sin PDF)"
    >
      <PhotoIcon className="w-4 h-4" />
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
  const base =
    "inline-flex items-center justify-center w-8 h-8 rounded-lg transition";

  if (!enabled || !href) {
    return (
      <span
        className={`${base} text-slate-600 opacity-40 cursor-not-allowed border border-white/5`}
        aria-label={`${label} (no disponible)`}
        title={`${label} (no disponible)`}
      >
        <DownloadIcon className="w-4 h-4" />
      </span>
    );
  }

  const styles =
    variant === "cliente"
      ? "bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/50"
      : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${styles}`}
      aria-label={label}
      title={label}
    >
      <DownloadIcon className="w-4 h-4" />
    </a>
  );
}

/* ---------- Empty State ---------- */

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-10 md:p-14 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
        <FolderEmptyIcon className="w-8 h-8 text-cyan-300" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-white">
        {filtered
          ? "Sin cotizaciones que coincidan"
          : "Aún no tienes cotizaciones"}
      </h2>
      <p className="mt-2 text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
        {filtered
          ? "Ajusta los filtros o limpia la búsqueda para ver todas tus cotizaciones."
          : "Genera tu primera cotización en menos de un minuto. El PDF queda guardado aquí cuando termine."}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/dashboard/cotizar"
          className="px-5 py-2.5 bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_30px_rgba(29,78,216,0.5)] transition inline-flex items-center gap-2"
        >
          Empieza una nueva
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
        {filtered && (
          <Link
            href="/dashboard/historial"
            className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition"
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
      className="mt-4 flex items-center justify-between text-sm text-slate-400 flex-wrap gap-3"
    >
      <span>
        Mostrando <strong className="text-white tabular-nums">{start}</strong>–
        <strong className="text-white tabular-nums">{end}</strong> de{" "}
        <strong className="text-white tabular-nums">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(prevOffset)}
            className="px-3 py-1.5 border border-white/10 bg-white/5 rounded-lg hover:bg-white/10 hover:border-white/20 text-slate-200 transition"
          >
            ← Anterior
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-white/5 rounded-lg text-slate-600">
            ← Anterior
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(nextOffset)}
            className="px-3 py-1.5 border border-white/10 bg-white/5 rounded-lg hover:bg-white/10 hover:border-white/20 text-slate-200 transition"
          >
            Siguiente →
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-white/5 rounded-lg text-slate-600">
            Siguiente →
          </span>
        )}
      </div>
    </nav>
  );
}

/* ---------- Iconos ---------- */

function DownloadIcon({ className = "w-5 h-5" }: { className?: string }) {
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
      strokeWidth={1.8}
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

function PhotoIcon({ className = "w-4 h-4" }: { className?: string }) {
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
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  );
}
