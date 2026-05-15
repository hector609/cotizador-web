/**
 * /dashboard — home post-login del DAT.
 *
 * LUMINA Light Premium — pivot total desde el dark glassmorphism.
 *
 * Layout:
 *   [Sidebar fijo w-64 white]  [Main bg-slate-50 padding 64px]
 *
 * Capa de presentación reescrita end-to-end. Hooks de data fetching y los
 * cálculos derivados (`listarCotizaciones`, `calcularKpis`, `maskRfc`) se
 * mantienen 100% intactos — el rediseño es puramente visual + paridad de
 * funcionalidad con el shell anterior (Top cliente + Optimizaciones).
 *
 * Server Component: la home se renderiza una vez al entrar. Los KPI cards
 * y action tiles se delegan a Client Components hijos (`DashboardKpiCards`,
 * `DashboardActionTiles`) para que framer-motion + recharts + NumberFlow
 * vivan donde corresponden — JS de cliente sigue mínimo.
 */

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listarCotizaciones, maskRfc } from "@/lib/cotizaciones";
import type { Cotizacion } from "@/types/cotizacion";
import { Sidebar } from "@/components/admin/Sidebar";
import { DashboardKpiCards } from "@/components/admin/DashboardKpiCards";
import { DashboardActionTiles } from "@/components/admin/DashboardActionTiles";
import { TrialBanner } from "@/components/admin/TrialBanner";

const TELEGRAM_BOT_URL = "https://t.me/CotizadorInteligenteBot";
const KPI_LIMIT = 100;

interface DashboardKPIs {
  cotizacionesMes: number;
  montoMes: number;
  ticketPromedio: number;
  abPromedio: number;
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
    const lineas = Number.isFinite(c.lineas) ? c.lineas : 0;
    const plan = Number.isFinite(c.plan) ? c.plan : 0;
    return sum + plan * lineas;
  }, 0);

  const ticketPromedio =
    delMes.length > 0 ? Math.round(montoMes / delMes.length) : 0;

  // A/B promedio real: promedio del campo `rentabilidad` del backend
  // (string "22.5%" o "22.5") de las cotizaciones completadas del mes.
  const completadasMes = delMes.filter((c) => c.estado === "completada");
  const abValues = completadasMes
    .map((c) => {
      const raw = c.rentabilidad ?? null;
      if (!raw) return NaN;
      return parseFloat(raw.replace("%", "").replace(",", "."));
    })
    .filter((v) => Number.isFinite(v) && v >= 0);
  const abPromedio =
    abValues.length > 0
      ? Math.round((abValues.reduce((s, v) => s + v, 0) / abValues.length) * 10) / 10
      : 0;

  const rfcSet = new Set<string>();
  for (const c of rows) {
    if (c.rfc && c.rfc.length > 0) rfcSet.add(c.rfc);
  }

  const recientes = rows.slice(0, 8);

  // Top cliente del mes: RFC con mayor volumen entre las completadas del mes.
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
    abPromedio,
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

  const initials = String(session.vendedor_id).slice(0, 2).toUpperCase();
  const userLabel = `Vendedor #${session.vendedor_id}`;
  const userSubtitle = `Distribuidor ${session.tenant_id}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar
        active="inicio"
        initials={initials}
        userLabel={userLabel}
        userSubtitle={userSubtitle}
      />

      <main className="relative lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 md:px-16 py-10 md:py-16 space-y-12">
          {/* Trial Banner */}
          <TrialBanner />

          {/* Header */}
          <header>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
              Tu cotizador
            </h1>
            <p className="mt-3 text-base md:text-lg text-slate-500 max-w-2xl">
              Resumen del mes. Toda tu cartera, métricas y PDFs viven en este
              panel.
            </p>
          </header>

          {/* KPI cards (client, framer-motion + recharts + NumberFlow) */}
          <DashboardKpiCards
            kpis={{
              cotizacionesMes: kpis.cotizacionesMes,
              montoMes: kpis.montoMes,
              abPromedio: kpis.abPromedio,
              clientesActivos: kpis.clientesActivos,
            }}
          />

          {/* Action tiles (client, motion hover) */}
          <DashboardActionTiles />

          {/* Cotizaciones recientes */}
          <section aria-labelledby="recientes-heading">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2
                    id="recientes-heading"
                    className="text-xl font-extrabold tracking-tight text-slate-900"
                  >
                    Cotizaciones recientes
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Las últimas {kpis.recientes.length} generadas desde web o
                    Telegram.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <SegmentedControl />
                  <Link
                    href="/dashboard/historial"
                    aria-label="Exportar historial a Excel"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-slate-700 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 transition"
                  >
                    Exportar Excel
                  </Link>
                </div>
              </div>

              {!result.ok ? (
                <div role="alert" className="p-8">
                  <p className="text-sm font-semibold text-rose-700">
                    No pudimos cargar tus cotizaciones recientes.
                  </p>
                  <p className="text-xs text-rose-600 mt-1">{result.message}</p>
                </div>
              ) : kpis.recientes.length === 0 ? (
                <EmptyRecientes />
              ) : (
                <RecientesTable rows={kpis.recientes} />
              )}
            </div>
          </section>

          {/* Bottom row: Top cliente + Optimizaciones */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopClienteCard top={kpis.topCliente} />
            <OptimizacionesCard kpis={kpis} totalRows={rows.length} />
          </section>

          {/* Footer */}
          <footer className="pt-6 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 text-xs text-slate-500">
            <p>
              ¿Prefieres Telegram?{" "}
              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
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
                className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
              >
                @hectoria.mx
              </a>
              <span className="mx-2 text-slate-300">·</span>
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
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 10_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return `$${Math.round(value).toLocaleString("es-MX")}`;
}

function SegmentedControl() {
  // Segmented control puramente visual por ahora; la página /dashboard/historial
  // ya soporta filtros. Cuando exista filtro inline aquí, conectarlo.
  return (
    <div
      role="tablist"
      aria-label="Rango de fechas"
      className="inline-flex items-center bg-slate-100 rounded-full p-1 text-xs font-semibold"
    >
      <span
        role="tab"
        aria-selected="true"
        className="px-3 py-1.5 rounded-full bg-white text-slate-900 shadow-sm"
      >
        Semana
      </span>
      <span
        role="tab"
        aria-selected="false"
        className="px-3 py-1.5 rounded-full text-slate-500"
      >
        Mes
      </span>
      <span
        role="tab"
        aria-selected="false"
        className="px-3 py-1.5 rounded-full text-slate-500"
      >
        Trimestre
      </span>
    </div>
  );
}

function RecientesTable({ rows }: { rows: Cotizacion[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50/60 text-slate-500 uppercase text-[10px] tracking-widest font-bold border-b border-slate-100">
          <tr>
            <th scope="col" className="text-left px-6 py-3">
              Folio
            </th>
            <th scope="col" className="text-left px-6 py-3">
              Cliente
            </th>
            <th scope="col" className="text-right px-6 py-3">
              Líneas
            </th>
            <th scope="col" className="text-right px-6 py-3">
              Monto
            </th>
            <th scope="col" className="text-left px-6 py-3">
              A/B
            </th>
            <th scope="col" className="text-left px-6 py-3">
              Estado
            </th>
            <th scope="col" className="text-right px-6 py-3">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((c) => (
            <RecienteRow key={c.id} c={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecienteRow({ c }: { c: Cotizacion }) {
  const folio = c.id.slice(0, 8).toUpperCase();
  const lineas = Number.isFinite(c.lineas) ? c.lineas : 0;
  const plan = Number.isFinite(c.plan) ? c.plan : 0;
  const monto = plan * lineas;

  // A/B real: viene del backend como string "22.5%" o "22.5".
  // Normalizamos a número solo para la barra visual; mostramos el string original.
  const abRaw = c.rentabilidad ?? null;
  const abNum = abRaw
    ? parseFloat(abRaw.replace("%", "").replace(",", "."))
    : NaN;
  const abHasValue = abRaw && Number.isFinite(abNum) && abNum >= 0;

  return (
    <tr className="group transition-colors hover:bg-indigo-50/30">
      <td className="px-6 py-4 font-mono text-cyan-600 text-xs">{folio}</td>
      <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">
        {maskRfc(c.rfc)}
      </td>
      <td className="px-6 py-4 text-right text-slate-700 tabular-nums">
        {lineas}
      </td>
      <td className="px-6 py-4 text-right text-slate-900 font-semibold tabular-nums whitespace-nowrap">
        {monto > 0 ? formatMxnShort(monto) : "—"}
      </td>
      <td className="px-6 py-4">
        {abHasValue ? (
          <div className="flex items-center gap-2 min-w-[80px]">
            <span className="text-xs font-semibold text-slate-700 tabular-nums w-8">
              {abNum.toFixed(1)}%
            </span>
            <span
              className="h-1.5 flex-1 max-w-[60px] rounded-full bg-slate-100 overflow-hidden"
              aria-hidden="true"
            >
              <span
                className="block h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                style={{ width: `${Math.min(100, abNum * 3)}%` }}
              />
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
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
              title="Descargar PDF cliente"
              aria-label={`Descargar PDF cliente del folio ${folio}`}
              className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full hover:bg-indigo-100 transition"
            >
              PDF Cliente
            </a>
          )}
          {c.estado === "completada" && c.pdf_url_interno && (
            <a
              href={c.pdf_url_interno}
              target="_blank"
              rel="noopener noreferrer"
              title="Descargar PDF interno (rentabilidad)"
              aria-label={`Descargar PDF interno del folio ${folio}`}
              className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full hover:bg-slate-200 transition"
            >
              PDF Interno
            </a>
          )}
          <Link
            href={`/dashboard/historial?folio=${c.id}`}
            title="Ver detalle"
            aria-label={`Ver detalle del folio ${folio}`}
            className="inline-flex items-center px-2.5 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-full hover:border-indigo-200 hover:text-indigo-700 transition"
          >
            Ver
          </Link>
          {c.estado === "fallida" && (
            <Link
              href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
              aria-label={`Reintentar cotización ${folio}`}
              className="inline-flex items-center px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full hover:bg-rose-100 transition"
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
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Completada
      </span>
    );
  }
  if (estado === "pendiente") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 uppercase tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
      Falló
    </span>
  );
}

function EmptyRecientes() {
  return (
    <div className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-4">
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
            d="M9 12h6m-6 4h4m1-12H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"
          />
        </svg>
      </div>
      <h3 className="text-base font-bold text-slate-900">
        Aún no tienes cotizaciones
      </h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
        Genera la primera desde el chat. Toma 3-5 minutos y el PDF oficial queda
        guardado aquí.
      </p>
      <Link
        href="/dashboard/cotizar"
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-indigo-600 to-cyan-500 text-white text-sm font-semibold rounded-full hover:shadow-lg hover:shadow-indigo-200 transition"
      >
        Crear primera cotización
      </Link>
    </div>
  );
}

function TopClienteCard({ top }: { top: TopCliente | null }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
      <h3 className="text-base font-extrabold tracking-tight text-slate-900 mb-5">
        Tu mejor cliente del mes
      </h3>
      {top ? (
        <>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold">
              <BuildingIcon />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-900 truncate">
                {maskRfc(top.rfc)}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                {top.cotizaciones} cotización
                {top.cotizaciones === 1 ? "" : "es"} este mes
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Cerradas
              </p>
              <p className="font-extrabold text-slate-900 tabular-nums">
                {top.cotizaciones}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Volumen
              </p>
              <p className="font-extrabold text-indigo-600 tabular-nums">
                {top.volumen > 0 ? formatMxnShort(top.volumen) : "—"}
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/cliente?rfc=${encodeURIComponent(top.rfc)}`}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            Ver detalle de cliente →
          </Link>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Cuando cierres tu primera cotización del mes, aquí verás a tu cliente
          top.
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
  const tips: Array<{ tone: "indigo" | "amber" | "emerald"; title: string; body: string }> =
    [];

  const fallidas =
    totalRows > 0
      ? Math.max(
          0,
          totalRows -
            kpis.cotizacionesMes -
            kpis.recientes.filter((r) => r.estado === "pendiente").length,
        )
      : 0;

  if (kpis.cotizacionesMes === 0 && totalRows === 0) {
    tips.push({
      tone: "indigo",
      title: "Empieza por una cotización rápida",
      body: "Tu primera cotización toma 3-5 minutos. El asistente te guía paso a paso.",
    });
  }
  if (
    kpis.cotizacionesMes > 0 &&
    kpis.ticketPromedio < 5000 &&
    kpis.ticketPromedio > 0
  ) {
    tips.push({
      tone: "indigo",
      title: "Tickets bajo $5K MXN",
      body: "Considera ofrecer planes con plazo forzoso 24m para mejorar margen.",
    });
  }
  if (fallidas >= 2) {
    tips.push({
      tone: "amber",
      title: "Cotizaciones fallidas pendientes",
      body: `Tienes ${fallidas} cotización${fallidas === 1 ? "" : "es"} sin completar. Reintenta desde el historial.`,
    });
  }
  if (kpis.clientesActivos >= 10) {
    tips.push({
      tone: "emerald",
      title: "Cartera robusta",
      body: `${kpis.clientesActivos} clientes activos. Revisa renovaciones próximas en Mis clientes.`,
    });
  }
  if (tips.length === 0) {
    tips.push({
      tone: "emerald",
      title: "Sigue así",
      body: "Tus métricas se ven sanas. Mantén el ritmo cotizando esta semana.",
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
      <h3 className="text-base font-extrabold tracking-tight text-slate-900 mb-5 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-600">
          <LightbulbIcon />
        </span>
        Optimizaciones sugeridas
      </h3>
      <ul className="space-y-3">
        {tips.slice(0, 3).map((t, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
          >
            <span
              aria-hidden="true"
              className={[
                "mt-1 w-2 h-2 rounded-full shrink-0",
                t.tone === "indigo"
                  ? "bg-indigo-500"
                  : t.tone === "amber"
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              ].join(" ")}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 mb-0.5">
                {t.title}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">{t.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Iconos inline mínimos ---------- */

function BuildingIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="w-7 h-7"
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

function LightbulbIcon() {
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
        d="M12 18v-2m0 0a4 4 0 002.5-7.1A4 4 0 0012 4a4 4 0 00-2.5 6.9A4 4 0 0012 16zm-3 3h6"
      />
    </svg>
  );
}
