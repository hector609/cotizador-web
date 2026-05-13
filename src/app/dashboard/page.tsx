/**
 * /dashboard — home post-login del DAT.
 *
 * REDISEÑO "REVENTAR mode" (dark glassmorphism premium tipo Linear/Vercel).
 *
 * Layout:
 *   [Sidebar fijo w-64 #060e20]  [Main #0b1326 + mesh-gradient + grain]
 *
 * Capa de presentación reescrita. Hooks de data fetching y los cálculos
 * derivados (`listarCotizaciones`, `calcularKpis`, `maskRfc`) se mantienen
 * 100% intactos — el rediseño es puramente visual + 2 secciones nuevas
 * (Top cliente del mes + Optimizaciones) calculadas server-side desde la
 * misma fuente (`rows`).
 *
 * Por qué Server Component: la home se renderiza una vez al entrar y el
 * cálculo cabe en milisegundos. Cero JS de cliente para la vista hace
 * que el TTFB sea casi instantáneo en 4G mexicana.
 */

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listarCotizaciones, maskRfc } from "@/lib/cotizaciones";
import type { Cotizacion } from "@/types/cotizacion";
import { Sidebar } from "@/components/admin/Sidebar";

const TELEGRAM_BOT_URL = "https://t.me/CotizadorInteligenteBot";
const KPI_LIMIT = 100;

interface DashboardKPIs {
  cotizacionesMes: number;
  montoMes: number;
  ticketPromedio: number;
  clientesActivos: number;
  recientes: Cotizacion[];
  topCliente: TopCliente | null;
}

interface TopCliente {
  rfc: string;
  cotizaciones: number;
  volumen: number;
}

function calcularKpis(rows: Cotizacion[]): DashboardKPIs {
  const ahora = new Date();
  const mesActual = ahora.getUTCMonth();
  const anioActual = ahora.getUTCFullYear();

  // Cotizaciones completadas del mes en curso — lo que cuenta como ingreso
  // comprometido. Pendientes/fallidas no inflan métricas.
  const delMes = rows.filter((c) => {
    if (c.estado !== "completada") return false;
    const d = new Date(c.created_at);
    if (Number.isNaN(d.getTime())) return false;
    return d.getUTCMonth() === mesActual && d.getUTCFullYear() === anioActual;
  });

  const montoMes = delMes.reduce((sum, c) => {
    // `plan` es plan mensual MXN/línea en single-perfil. En multi viene 0;
    // como aproximación legible usamos `plan * lineas`.
    const lineas = Number.isFinite(c.lineas) ? c.lineas : 0;
    const plan = Number.isFinite(c.plan) ? c.plan : 0;
    return sum + plan * lineas;
  }, 0);

  const ticketPromedio =
    delMes.length > 0 ? Math.round(montoMes / delMes.length) : 0;

  const rfcSet = new Set<string>();
  for (const c of rows) {
    if (c.rfc && c.rfc.length > 0) rfcSet.add(c.rfc);
  }

  const recientes = rows.slice(0, 5);

  // Top cliente del mes: RFC con mayor volumen (plan * líneas) entre las
  // cotizaciones completadas del mes en curso. Si todas tienen plan=0 (multi),
  // ranking por # cotizaciones como fallback.
  const agg = new Map<string, { cotizaciones: number; volumen: number }>();
  for (const c of delMes) {
    if (!c.rfc) continue;
    const existing = agg.get(c.rfc) ?? { cotizaciones: 0, volumen: 0 };
    existing.cotizaciones += 1;
    const lineas = Number.isFinite(c.lineas) ? c.lineas : 0;
    const plan = Number.isFinite(c.plan) ? c.plan : 0;
    existing.volumen += plan * lineas;
    agg.set(c.rfc, existing);
  }
  let topCliente: TopCliente | null = null;
  for (const [rfc, v] of agg.entries()) {
    if (
      !topCliente ||
      v.volumen > topCliente.volumen ||
      (v.volumen === topCliente.volumen && v.cotizaciones > topCliente.cotizaciones)
    ) {
      topCliente = { rfc, cotizaciones: v.cotizaciones, volumen: v.volumen };
    }
  }

  return {
    cotizacionesMes: delMes.length,
    montoMes,
    ticketPromedio,
    clientesActivos: rfcSet.size,
    recientes,
    topCliente,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  const result = await listarCotizaciones(session.tenant_id, {
    limit: KPI_LIMIT,
    offset: 0,
  });
  const rows = result.ok ? result.data.cotizaciones : [];
  const kpis = calcularKpis(rows);

  // Iniciales para el avatar del sidebar — derivadas del vendedor_id ya que
  // la sesión no expone email firmado. Estable y suficiente para decoración.
  const initials = String(session.vendedor_id).slice(0, 2).toUpperCase();
  const userLabel = `Vendedor #${session.vendedor_id}`;
  const userSubtitle = `Distribuidor ${session.tenant_id}`;

  return (
    <div className="min-h-screen bg-[#0b1326] text-slate-200 antialiased">
      <Sidebar
        active="inicio"
        initials={initials}
        userLabel={userLabel}
        userSubtitle={userSubtitle}
      />

      {/* Main content. ml-64 en desktop para liberar espacio del sidebar
          fijo; pt-14 en mobile para no chocar con el top-bar mobile. */}
      <main className="relative lg:ml-64 pt-14 lg:pt-0 min-h-screen overflow-hidden">
        {/* Mesh radial top-right (blue/cyan) + faint grid hairline. Capa fija
            detrás del contenido — pointer-events:none para no interferir. */}
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
          {/* Topbar inline: breadcrumb + notif */}
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <HomeMiniIcon />
              <span>/</span>
              <span className="text-white">Inicio</span>
            </div>
            <button
              type="button"
              className="relative text-slate-400 hover:text-white transition"
              aria-label="Notificaciones"
            >
              <BellIcon />
              <span
                className="absolute top-0 right-0 w-2 h-2 bg-cyan-400 rounded-full border border-[#0b1326] shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                aria-hidden="true"
              />
            </button>
          </div>

          {/* H1 hero */}
          <header className="mb-12">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
              Tu cotizador
            </h1>
            <p className="mt-3 text-base md:text-lg text-slate-400 max-w-2xl">
              Resumen del mes en curso. Toda tu cartera, métricas y PDFs viven
              en este panel.
            </p>
          </header>

          {/* KPI cards */}
          <section
            aria-labelledby="kpis-heading"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12"
          >
            <h2 id="kpis-heading" className="sr-only">
              Métricas del mes
            </h2>
            <KpiCard
              label="Cotizaciones del mes"
              value={kpis.cotizacionesMes.toLocaleString("es-MX")}
              valueClass="text-5xl md:text-6xl"
              empty={!result.ok}
              icon={<DocumentBigIcon />}
              sparkline
            />
            <KpiCard
              label="Monto cotizado"
              value={
                kpis.montoMes > 0
                  ? formatMxnShort(kpis.montoMes)
                  : kpis.cotizacionesMes > 0
                    ? "—"
                    : "$0"
              }
              suffix={kpis.montoMes > 0 ? "MXN" : undefined}
              empty={!result.ok}
              icon={<DollarBigIcon />}
            />
            <KpiCard
              label="Ticket promedio"
              value={
                kpis.ticketPromedio > 0
                  ? formatMxnShort(kpis.ticketPromedio)
                  : "—"
              }
              hint={
                kpis.cotizacionesMes > 0
                  ? `${kpis.cotizacionesMes} cotización${kpis.cotizacionesMes === 1 ? "" : "es"}`
                  : undefined
              }
              empty={!result.ok}
              icon={<ChatBigIcon />}
            />
            <KpiCard
              label="Clientes activos"
              value={kpis.clientesActivos.toLocaleString("es-MX")}
              hint={kpis.clientesActivos > 0 ? "RFCs únicos" : undefined}
              empty={!result.ok}
              icon={<UsersBigIcon />}
            />
          </section>

          {/* Action tiles */}
          <section
            aria-labelledby="acciones-heading"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12"
          >
            <h2 id="acciones-heading" className="sr-only">
              Acciones rápidas
            </h2>
            <ActionTile
              href="/dashboard/cotizar"
              title="Nueva cotización"
              icon={<ChatBigIcon className="w-12 h-12" />}
              variant="primary"
            />
            <ActionTile
              href="/dashboard/cotizar-excel"
              title="Subir Excel"
              icon={<UploadBigIcon className="w-12 h-12" />}
            />
            <ActionTile
              href="/dashboard/clientes"
              title="Mis clientes"
              icon={<UsersBigIcon className="w-12 h-12" />}
            />
            <ActionTile
              href="/dashboard/catalogos"
              title="Catálogo"
              icon={<InventoryBigIcon className="w-12 h-12" />}
            />
          </section>

          {/* Cotizaciones recientes */}
          <section
            aria-labelledby="recientes-heading"
            className="mb-12"
          >
            <div className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 overflow-hidden">
              <div className="px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2
                    id="recientes-heading"
                    className="text-xl font-bold text-white"
                  >
                    Cotizaciones recientes
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Las últimas 5 generadas desde web o Telegram.
                  </p>
                </div>
                <Link
                  href="/dashboard/historial"
                  className="text-sm font-medium text-cyan-300 hover:text-cyan-200 whitespace-nowrap inline-flex items-center gap-1"
                >
                  Ver historial
                  <ArrowRightSmallIcon />
                </Link>
              </div>

              {!result.ok ? (
                <div className="p-8">
                  <p className="text-sm font-semibold text-red-300">
                    No pudimos cargar tus cotizaciones recientes.
                  </p>
                  <p className="text-xs text-red-200/80 mt-1">
                    {result.message}
                  </p>
                </div>
              ) : kpis.recientes.length === 0 ? (
                <EmptyRecientes />
              ) : (
                <RecientesTable rows={kpis.recientes} />
              )}
            </div>
          </section>

          {/* Bottom row: Top cliente + Optimizaciones */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-12">
            <TopClienteCard top={kpis.topCliente} />
            <OptimizacionesCard kpis={kpis} totalRows={rows.length} />
          </section>

          {/* Footer */}
          <footer className="pt-6 border-t border-white/10 flex flex-wrap justify-between items-center gap-3 text-xs text-slate-500">
            <p>
              ¿Prefieres Telegram?{" "}
              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
              >
                Abrir bot
              </a>
            </p>
            <p>
              Soporte:{" "}
              <a
                href="https://instagram.com/hectoria.mx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
              >
                @hectoria.mx
              </a>
              <span className="mx-2 text-slate-700">·</span>
              <span>© 2026 Hectoria</span>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

/* ---------- Sub-componentes ---------- */

function formatMxnShort(value: number): string {
  // Tickets corporativos: representación compacta para no romper la card.
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 10_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return `$${Math.round(value).toLocaleString("es-MX")}`;
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  suffix?: string;
  empty?: boolean;
  icon?: React.ReactNode;
  valueClass?: string;
  sparkline?: boolean;
}

function KpiCard({
  label,
  value,
  hint,
  suffix,
  empty = false,
  icon,
  valueClass,
  sparkline = false,
}: KpiCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-6 transition-all duration-300 hover:scale-[1.02] hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]">
      {/* Watermark icon esquina superior derecha */}
      {icon && (
        <div
          aria-hidden="true"
          className="absolute top-4 right-4 text-cyan-400/10 group-hover:text-cyan-400/20 transition-colors"
        >
          {icon}
        </div>
      )}

      <p className="text-xs font-medium tracking-wider text-slate-400 uppercase mb-3">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span
          className={[
            "font-black tracking-tighter tabular-nums",
            valueClass ?? "text-4xl md:text-5xl",
            empty ? "text-slate-500" : "text-white",
          ].join(" ")}
        >
          {empty ? "—" : value}
        </span>
        {suffix && (
          <span className="text-base text-slate-400 font-normal">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-2 text-xs text-slate-400 font-medium">{hint}</p>
      )}
      {sparkline && !empty && (
        <Sparkline />
      )}
    </div>
  );
}

/**
 * Sparkline decorativo SVG inline (sin librería). Es ilustrativo —
 * no representa data real porque el listing no expone serie temporal.
 * Cuando se exponga un endpoint /kpis/serie, reemplazar `points`.
 */
function Sparkline() {
  // Curva creciente "buena vibra" — 7 puntos estilizados.
  const points = [
    [0, 32],
    [16, 26],
    [32, 28],
    [48, 18],
    [64, 22],
    [80, 12],
    [96, 6],
  ];
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ");
  // Area fill (cierra al baseline)
  const areaD = `${pathD} L 96 40 L 0 40 Z`;
  return (
    <svg
      viewBox="0 0 96 40"
      className="mt-4 h-10 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(34, 211, 238)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(34, 211, 238)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#spark-gradient)" />
      <path
        d={pathD}
        fill="none"
        stroke="rgb(34, 211, 238)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter: "drop-shadow(0 0 4px rgba(34,211,238,0.6))",
        }}
      />
    </svg>
  );
}

interface ActionTileProps {
  href: string;
  title: string;
  icon: React.ReactNode;
  variant?: "primary" | "default";
}

function ActionTile({ href, title, icon, variant = "default" }: ActionTileProps) {
  const isPrimary = variant === "primary";
  return (
    <Link
      href={href}
      className={[
        "group relative overflow-hidden rounded-xl p-8 transition-all duration-300 hover:scale-[1.03]",
        isPrimary
          ? "bg-gradient-to-br from-blue-600 to-cyan-500 border border-white/20 shadow-[0_0_30px_rgba(29,78,216,0.3)] hover:shadow-[0_0_40px_rgba(29,78,216,0.55)]"
          : "bg-white/[0.04] backdrop-blur-[12px] border border-white/10 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.18)]",
      ].join(" ")}
    >
      <div
        className={[
          "mb-4",
          isPrimary
            ? "text-white"
            : "text-slate-400 group-hover:text-cyan-300 transition-colors",
        ].join(" ")}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
    </Link>
  );
}

function RecientesTable({ rows }: { rows: Cotizacion[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.02] text-slate-500 uppercase text-[10px] tracking-widest font-bold border-b border-white/10">
          <tr>
            <th className="text-left px-6 py-3">Folio</th>
            <th className="text-left px-6 py-3">Cliente</th>
            <th className="text-right px-6 py-3">Líneas</th>
            <th className="text-right px-6 py-3">Fecha</th>
            <th className="text-left px-6 py-3">Estado</th>
            <th className="text-right px-6 py-3">PDF</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((c) => (
            <RecienteRow key={c.id} c={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecienteRow({ c }: { c: Cotizacion }) {
  const fecha = new Date(c.created_at);
  const fechaStr = Number.isNaN(fecha.getTime())
    ? c.created_at
    : fecha.toLocaleString("es-MX", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

  // Folio: usamos los primeros 8 chars del UUID como display compacto. NO
  // confiar para igualdad — el ID completo va en links.
  const folio = c.id.slice(0, 8).toUpperCase();

  return (
    <tr className="hover:bg-white/[0.03] transition-colors group">
      <td className="px-6 py-4 font-mono text-cyan-300 text-xs">{folio}</td>
      <td className="px-6 py-4 text-white font-medium whitespace-nowrap">
        {maskRfc(c.rfc)}
      </td>
      <td className="px-6 py-4 text-right text-slate-300 tabular-nums">
        {c.lineas}
      </td>
      <td className="px-6 py-4 text-right text-slate-400 tabular-nums whitespace-nowrap">
        {fechaStr}
      </td>
      <td className="px-6 py-4">
        <EstadoChip estado={c.estado} />
      </td>
      <td className="px-6 py-4 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5">
          {c.estado === "completada" && c.pdf_url && (
            <a
              href={c.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2.5 py-1 bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-medium rounded-md hover:bg-cyan-500/25 transition"
              title="PDF cliente"
            >
              Cliente
            </a>
          )}
          {c.estado === "completada" && c.pdf_url_interno && (
            <a
              href={c.pdf_url_interno}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2.5 py-1 bg-white/5 border border-white/10 text-slate-300 text-xs font-medium rounded-md hover:bg-white/10 transition"
              title="PDF interno (rentabilidad)"
            >
              Interno
            </a>
          )}
          {c.estado === "completada" && !c.pdf_url && (
            <span className="text-xs text-slate-500">Sin enlace</span>
          )}
          {c.estado === "pendiente" && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-300">
              En curso
            </span>
          )}
          {c.estado === "fallida" && (
            <Link
              href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
              className="inline-flex items-center px-2.5 py-1 bg-white/5 border border-white/10 text-slate-300 text-xs font-medium rounded-md hover:bg-white/10 transition"
            >
              Reintentar
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

function EstadoChip({ estado }: { estado: Cotizacion["estado"] }) {
  if (estado === "completada") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
        Completada
      </span>
    );
  }
  if (estado === "pendiente") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-400/10 text-red-300 border border-red-400/30 uppercase tracking-wider">
      Falló
    </span>
  );
}

function EmptyRecientes() {
  return (
    <div className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-400/20 mb-4">
        <DocumentBigIcon className="w-6 h-6 text-cyan-300" />
      </div>
      <h3 className="text-base font-bold text-white">
        Aún no tienes cotizaciones
      </h3>
      <p className="mt-1 text-sm text-slate-400 max-w-sm mx-auto">
        Genera la primera desde el chat. Toma 3-5 minutos y el PDF oficial
        queda guardado aquí.
      </p>
      <Link
        href="/dashboard/cotizar"
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(29,78,216,0.5)] transition"
      >
        Crear primera cotización
        <ArrowRightSmallIcon />
      </Link>
    </div>
  );
}

function TopClienteCard({ top }: { top: TopCliente | null }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-6 group">
      <div
        aria-hidden="true"
        className="absolute right-0 top-0 w-32 h-32 bg-cyan-400/10 blur-3xl rounded-full"
      />
      <h3 className="text-base font-bold text-white mb-5 relative">
        Tu mejor cliente del mes
      </h3>
      {top ? (
        <>
          <div className="flex items-center gap-4 mb-5 relative">
            <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <BuildingIcon className="w-7 h-7 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-white truncate">
                {maskRfc(top.rfc)}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                {top.cotizaciones} cotización
                {top.cotizaciones === 1 ? "" : "es"} este mes
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5 relative">
            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Cerradas
              </p>
              <p className="font-bold text-white">{top.cotizaciones}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Volumen
              </p>
              <p className="font-bold text-cyan-300 tabular-nums">
                {top.volumen > 0 ? formatMxnShort(top.volumen) : "—"}
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/cliente?rfc=${encodeURIComponent(top.rfc)}`}
            className="text-sm font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 relative"
          >
            Ver detalle de cliente <ArrowRightSmallIcon />
          </Link>
        </>
      ) : (
        <p className="text-sm text-slate-400 relative">
          Cuando cierres tu primera cotización del mes, aquí verás a tu
          cliente top.
        </p>
      )}
    </div>
  );
}

function OptimizacionesCard({
  kpis,
  totalRows,
}: {
  kpis: DashboardKPIs;
  totalRows: number;
}) {
  // Tips derivados de la data real — NO inventar números.
  const tips: Array<{ icon: React.ReactNode; title: string; body: string }> =
    [];

  const fallidas = totalRows > 0
    ? Math.max(0, totalRows - kpis.cotizacionesMes - kpis.recientes.filter((r) => r.estado === "pendiente").length)
    : 0;

  if (kpis.cotizacionesMes === 0 && totalRows === 0) {
    tips.push({
      icon: <LightbulbIcon className="text-cyan-300" />,
      title: "Empieza por una cotización rápida",
      body: "Tu primera cotización toma 3-5 minutos. El asistente te guía paso a paso.",
    });
  }
  if (kpis.cotizacionesMes > 0 && kpis.ticketPromedio < 5000 && kpis.ticketPromedio > 0) {
    tips.push({
      icon: <TrendingIcon className="text-cyan-300" />,
      title: "Tickets bajo $5K MXN",
      body: "Considera ofrecer planes con plazo forzoso 24m para mejorar margen.",
    });
  }
  if (fallidas >= 2) {
    tips.push({
      icon: <RefreshIcon className="text-amber-300" />,
      title: "Cotizaciones fallidas pendientes",
      body: `Tienes ${fallidas} cotización${fallidas === 1 ? "" : "es"} sin completar. Reintenta desde el historial.`,
    });
  }
  if (kpis.clientesActivos >= 10) {
    tips.push({
      icon: <UsersSmallIcon className="text-cyan-300" />,
      title: "Cartera robusta",
      body: `${kpis.clientesActivos} clientes activos. Revisa renovaciones próximas en Mis clientes.`,
    });
  }
  if (tips.length === 0) {
    tips.push({
      icon: <LightbulbIcon className="text-cyan-300" />,
      title: "Sigue así",
      body: "Tus métricas se ven sanas. Mantén el ritmo cotizando esta semana.",
    });
  }

  return (
    <div className="rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-6">
      <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
        <LightbulbIcon className="text-amber-300" />
        Optimizaciones sugeridas
      </h3>
      <div className="space-y-3">
        {tips.slice(0, 3).map((t, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors"
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0">
              {t.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white mb-1">{t.title}</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Iconos inline (24/24 outline) ---------- */

function HomeMiniIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-6 h-6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
      />
    </svg>
  );
}

function DocumentBigIcon({ className = "w-8 h-8" }: { className?: string }) {
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
        d="M19 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113 7.125v-1.5A3.375 3.375 0 009.625 2.25H8.25M9 12h6m-6 3h6m-6 3h3.75M8.25 2.25H5.625A1.125 1.125 0 004.5 3.375v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25A9 9 0 0010.5 2.25"
      />
    </svg>
  );
}

function DollarBigIcon({ className = "w-8 h-8" }: { className?: string }) {
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
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4M12 4.5v15"
      />
    </svg>
  );
}

function ChatBigIcon({ className = "w-8 h-8" }: { className?: string }) {
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
        d="M20.25 8.5c.88.29 1.5 1.13 1.5 2.1v4.3a2.2 2.2 0 01-2 2.2c-.34.02-.68.05-1.02.07v3.1l-3-3c-1.35 0-2.7-.05-4.02-.16M3 6.6c0-1.62 1.15-3.02 2.76-3.23A48 48 0 0111.25 3c2.1 0 4.2.14 6.24.4 1.6.21 2.76 1.61 2.76 3.23v6.23c0 1.62-1.15 3.02-2.76 3.23-.58.08-1.16.14-1.74.19V21l-4.16-4.16"
      />
    </svg>
  );
}

function UsersBigIcon({ className = "w-8 h-8" }: { className?: string }) {
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
        d="M15 19.13a9.4 9.4 0 002.63.37 9.34 9.34 0 004.12-.95 4.12 4.12 0 00-7.53-2.5M15 19.13c0-1.1-.29-2.15-.79-3.06M15 19.13v.1A12.32 12.32 0 018.62 21c-2.33 0-4.51-.65-6.37-1.77v-.1A6.38 6.38 0 0114.21 16.07M12 6.38a3.38 3.38 0 11-6.75 0 3.38 3.38 0 016.75 0zm8.25 2.25a2.62 2.62 0 11-5.25 0 2.62 2.62 0 015.25 0z"
      />
    </svg>
  );
}

function UploadBigIcon({ className = "w-8 h-8" }: { className?: string }) {
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
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5v12"
      />
    </svg>
  );
}

function InventoryBigIcon({ className = "w-8 h-8" }: { className?: string }) {
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
        d="M4 7l8-4 8 4M4 7v10l8 4 8-4V7M4 7l8 4m0 0l8-4m-8 4v10"
      />
    </svg>
  );
}

function ArrowRightSmallIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-3.5 h-3.5"
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

function BuildingIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}

function LightbulbIcon({ className = "w-5 h-5" }: { className?: string }) {
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
        d="M12 18v-2m0 0a4 4 0 002.5-7.1A4 4 0 0012 4a4 4 0 00-2.5 6.9A4 4 0 0012 16zm-3 3h6"
      />
    </svg>
  );
}

function TrendingIcon({ className = "w-5 h-5" }: { className?: string }) {
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
        d="M2.25 18L9 11.25l4.31 4.31a11.95 11.95 0 015.81-5.52l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.94"
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

function UsersSmallIcon({ className = "w-5 h-5" }: { className?: string }) {
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
        d="M16 18a4 4 0 00-8 0M12 14a4 4 0 100-8 4 4 0 000 8zM20 19a3 3 0 00-3-3M4 19a3 3 0 013-3"
      />
    </svg>
  );
}
