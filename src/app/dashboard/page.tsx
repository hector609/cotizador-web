/**
 * /dashboard — home post-login del DAT.
 *
 * Capa de presentación premium B2B (estilo Vercel/Linear/Plausible): topbar
 * unificada + H1 propio + grid de 4 KPIs + sección "Cotizaciones recientes"
 * + grid de 4 acciones rápidas. NO toca lógica ni endpoints — los KPIs se
 * derivan server-side del listing existente (`listarCotizaciones`) que ya
 * usa la página /historial.
 *
 * Por qué Server Component: la home se renderiza una vez al entrar y el
 * cálculo (count, sum, unique RFCs) cabe en milisegundos. Cero JS de
 * cliente para esta vista hace que el TTFB del dashboard sea casi
 * instantáneo en 4G mexicana — clave para "confiabilidad bancaria".
 */

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listarCotizaciones, maskRfc } from "@/lib/cotizaciones";
import type { Cotizacion } from "@/types/cotizacion";
import {
  ArrowRightIcon,
  ArrowUpTrayIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ClockIcon,
  UsersIcon,
} from "@/components/icons";
import { DashboardNav } from "./_nav";

// El bot de Telegram sigue activo como puerta secundaria — lo mostramos
// como link discreto en el footer, no como CTA principal.
const TELEGRAM_BOT_URL = "https://t.me/CotizadorInteligenteBot";

// Buffer suficiente para calcular "este mes" y "promedio ticket" sin
// segundo round-trip al backend. El listing devuelve hasta 100 por página;
// para mes corriente con 1-2 cotizaciones/día este límite es generoso.
const KPI_LIMIT = 100;

interface DashboardKPIs {
  cotizacionesMes: number;
  montoMes: number;
  ticketPromedio: number;
  clientesActivos: number;
  recientes: Cotizacion[];
}

function calcularKpis(rows: Cotizacion[]): DashboardKPIs {
  const ahora = new Date();
  const mesActual = ahora.getUTCMonth();
  const anioActual = ahora.getUTCFullYear();

  // Filtramos a "completadas del mes en curso" — es lo que cuenta como
  // ingreso comprometido. Las pendientes/fallidas no inflan métricas.
  const delMes = rows.filter((c) => {
    if (c.estado !== "completada") return false;
    const d = new Date(c.created_at);
    if (Number.isNaN(d.getTime())) return false;
    return d.getUTCMonth() === mesActual && d.getUTCFullYear() === anioActual;
  });

  const montoMes = delMes.reduce((sum, c) => {
    // `plan` es el plan mensual MXN por línea (single-perfil). En multi
    // el campo `plan` viene como 0/undefined y el monto real vive en el
    // PDF — para una métrica de "monto cotizado" del DAT, usar
    // `plan * lineas` como aproximación legible es suficiente.
    const lineas = Number.isFinite(c.lineas) ? c.lineas : 0;
    const plan = Number.isFinite(c.plan) ? c.plan : 0;
    return sum + plan * lineas;
  }, 0);

  const ticketPromedio =
    delMes.length > 0 ? Math.round(montoMes / delMes.length) : 0;

  // Clientes activos = RFCs únicos con al menos una cotización en el
  // listing (rolling window de hasta 100). Las cotizaciones "sin base"
  // (sin RFC) no cuentan.
  const rfcSet = new Set<string>();
  for (const c of rows) {
    if (c.rfc && c.rfc.length > 0) rfcSet.add(c.rfc);
  }

  // Recientes = top 5 por fecha desc (el backend ya ordena así).
  const recientes = rows.slice(0, 5);

  return {
    cotizacionesMes: delMes.length,
    montoMes,
    ticketPromedio,
    clientesActivos: rfcSet.size,
    recientes,
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

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="inicio" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        {/* Hero / saludo. H1 explícito (audit A1). */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Tu cotizador
          </h1>
          <p className="mt-2 text-slate-600 max-w-2xl">
            Genera cotizaciones oficiales sin abrir el portal Telcel. Toda tu
            cartera, métricas y PDFs viven en este panel.
          </p>
        </header>

        {/* KPI grid */}
        <section
          aria-labelledby="kpis-heading"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <h2 id="kpis-heading" className="sr-only">
            Métricas del mes
          </h2>
          <KpiCard
            label="Cotizaciones del mes"
            value={kpis.cotizacionesMes.toLocaleString("es-MX")}
            icon={<DocumentTextIcon className="w-5 h-5 text-blue-700" />}
            empty={!result.ok}
          />
          <KpiCard
            label="Monto cotizado (mes)"
            value={
              kpis.montoMes > 0
                ? formatMxn(kpis.montoMes)
                : kpis.cotizacionesMes > 0
                  ? "—"
                  : "$0"
            }
            hint={kpis.montoMes > 0 ? "Plan mensual × líneas" : undefined}
            icon={<CurrencyDollarIcon className="w-5 h-5 text-blue-700" />}
            empty={!result.ok}
          />
          <KpiCard
            label="Ticket promedio"
            value={
              kpis.ticketPromedio > 0
                ? formatMxn(kpis.ticketPromedio)
                : "—"
            }
            hint={
              kpis.cotizacionesMes > 0
                ? `${kpis.cotizacionesMes} cotización${kpis.cotizacionesMes === 1 ? "" : "es"} este mes`
                : undefined
            }
            icon={<ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-700" />}
            empty={!result.ok}
          />
          <KpiCard
            label="Clientes activos"
            value={kpis.clientesActivos.toLocaleString("es-MX")}
            hint={kpis.clientesActivos > 0 ? "RFCs únicos" : undefined}
            icon={<UsersIcon className="w-5 h-5 text-blue-700" />}
            empty={!result.ok}
          />
        </section>

        {/* Acciones rápidas */}
        <section
          aria-labelledby="acciones-heading"
          className="mt-12"
        >
          <h2
            id="acciones-heading"
            className="text-xl font-bold text-slate-900"
          >
            Acciones rápidas
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Las cuatro cosas que más vas a hacer cada día.
          </p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ActionTile
              href="/dashboard/cotizar"
              title="Nueva cotización"
              body="Conversa con el asistente y obtén el PDF en 3-5 minutos."
              icon={<ChatBubbleLeftRightIcon className="w-8 h-8 text-blue-700" />}
              primary
            />
            <ActionTile
              href="/dashboard/cotizar-excel"
              title="Subir Excel"
              body="Carga la plantilla multi-perfil para cotizaciones a granel."
              icon={<ArrowUpTrayIcon className="w-8 h-8 text-blue-700" />}
            />
            <ActionTile
              href="/dashboard/clientes"
              title="Mis clientes"
              body="Cartera sincronizada con el operador. Busca por RFC."
              icon={<UsersIcon className="w-8 h-8 text-blue-700" />}
            />
            <ActionTile
              href="/dashboard/catalogos"
              title="Catálogo"
              body="Planes y equipos vigentes con filtros encadenados."
              icon={<BookOpenIcon className="w-8 h-8 text-blue-700" />}
            />
          </div>
        </section>

        {/* Cotizaciones recientes */}
        <section
          aria-labelledby="recientes-heading"
          className="mt-12"
        >
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <h2
                id="recientes-heading"
                className="text-xl font-bold text-slate-900"
              >
                Cotizaciones recientes
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Las últimas 5 generadas desde web o Telegram.
              </p>
            </div>
            <Link
              href="/dashboard/historial"
              className="text-sm font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap inline-flex items-center gap-1"
            >
              Ver historial
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>

          {!result.ok ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <p className="text-sm font-semibold text-red-900">
                No pudimos cargar tus cotizaciones recientes.
              </p>
              <p className="text-xs text-red-700 mt-1">{result.message}</p>
            </div>
          ) : kpis.recientes.length === 0 ? (
            <EmptyRecientes />
          ) : (
            <RecientesTable rows={kpis.recientes} />
          )}
        </section>

        {/* Footer discreto: bot Telegram + soporte */}
        <footer className="mt-16 pt-8 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            ¿Prefieres Telegram? El bot sigue activo —{" "}
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:text-blue-800 underline underline-offset-2"
            >
              abrir bot
            </a>
            .
          </p>
          <p>
            Soporte:{" "}
            <a
              href="https://instagram.com/hectoria.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:text-blue-800 underline underline-offset-2"
            >
              @hectoria.mx
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ---------- Sub-componentes ---------- */

function formatMxn(value: number): string {
  // Tickets corporativos: no necesitamos centavos visibles.
  return `$${Math.round(value).toLocaleString("es-MX")}`;
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  empty?: boolean;
}

function KpiCard({ label, value, hint, icon, empty = false }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span aria-hidden="true">{icon}</span>
      </div>
      <p
        className={[
          "mt-3 text-3xl font-bold tracking-tight tabular-nums",
          empty ? "text-slate-300" : "text-slate-900",
        ].join(" ")}
      >
        {empty ? "—" : value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

interface ActionTileProps {
  href: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  primary?: boolean;
}

function ActionTile({ href, title, body, icon, primary = false }: ActionTileProps) {
  // El tile primario lleva un anillo sutil para guiar la primera acción
  // del DAT sin recurrir a gradientes saturados. Resto: outline neutro.
  return (
    <Link
      href={href}
      className={[
        "group rounded-xl border p-6 transition bg-white",
        "hover:border-blue-400 hover:shadow-sm",
        primary
          ? "border-blue-200 ring-1 ring-blue-100"
          : "border-slate-200",
      ].join(" ")}
    >
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 leading-relaxed">{body}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-700 group-hover:text-blue-800">
        Abrir
        <ArrowRightIcon className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}

function RecientesTable({ rows }: { rows: Cotizacion[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Cliente</th>
              <th className="text-right px-4 py-3 font-medium">Líneas</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-right px-4 py-3 font-medium">PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <RecienteRow key={c.id} c={c} />
            ))}
          </tbody>
        </table>
      </div>
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

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">
        {fechaStr}
      </td>
      <td className="px-4 py-3 font-mono text-slate-900 whitespace-nowrap">
        {maskRfc(c.rfc)}
      </td>
      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
        {c.lineas}
      </td>
      <td className="px-4 py-3">
        <EstadoBadge estado={c.estado} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5">
          {c.estado === "completada" && c.pdf_url && (
            <a
              href={c.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2.5 py-1 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 transition"
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
              className="inline-flex items-center px-2.5 py-1 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-50 transition"
              title="PDF interno (rentabilidad)"
            >
              Interno
            </a>
          )}
          {c.estado === "completada" && !c.pdf_url && (
            <span className="text-xs text-slate-400">Sin enlace</span>
          )}
          {c.estado === "pendiente" && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <ClockIcon className="w-3.5 h-3.5" />
              En curso
            </span>
          )}
          {c.estado === "fallida" && (
            <Link
              href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
              className="inline-flex items-center px-2.5 py-1 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-50 transition"
            >
              Reintentar
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

function EstadoBadge({ estado }: { estado: Cotizacion["estado"] }) {
  // Sin emojis (style-guide §5.1). Dot de color + label.
  if (estado === "completada") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-600" aria-hidden="true" />
        Completada
      </span>
    );
  }
  if (estado === "pendiente") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        En curso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
      <span className="w-1.5 h-1.5 rounded-full bg-red-600" aria-hidden="true" />
      Falló
    </span>
  );
}

function EmptyRecientes() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
      <DocumentTextIcon className="w-8 h-8 text-blue-700 mx-auto" />
      <h3 className="mt-4 font-semibold text-slate-900">
        Aún no tienes cotizaciones
      </h3>
      <p className="mt-1 text-sm text-slate-600 max-w-sm mx-auto">
        Genera la primera desde el chat. Toma 3-5 minutos y el PDF oficial queda
        guardado aquí.
      </p>
      <Link
        href="/dashboard/cotizar"
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
      >
        Crear primera cotización
        <ArrowRightIcon className="w-4 h-4" />
      </Link>
    </div>
  );
}
