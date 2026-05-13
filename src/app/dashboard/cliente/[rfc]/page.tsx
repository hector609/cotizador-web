/**
 * /dashboard/cliente/[rfc] — Server Component, vista detalle de un cliente
 * y su historial de cotizaciones.
 *
 * REDISEÑO LUMINA Light Premium.
 *
 *  - Surface bg-slate-50 + cards bg-white rounded-2xl shadow-sm.
 *  - H1 con nombre cliente text-4xl extrabold + RFC mono cyan-600 small.
 *  - 3 KPI cards arriba con NumberFlow + mini sparkline Recharts AreaChart cyan.
 *  - Timeline vertical de cotizaciones: dot color por estado + hairline
 *    divider izquierdo + motion.li con stagger fade-up entrance.
 *
 * Por qué Server Component: la página es lectura pura. `getSession()` redirige
 * a /login si no hay sesión válida, así que abajo siempre tenemos sesión.
 * Los pedacitos interactivos (NumberFlow, Recharts, motion) suben al
 * cliente vía `./_client.tsx`.
 *
 * Datos:
 *  - Lista de clientes (`${BOT_API_URL}/api/v1/clientes`) — para resolver
 *    el `nombre` del cliente desde el `rfc` que llega por URL. El backend
 *    NO acepta filtro por rfc, así que leemos toda la cartera y hacemos
 *    `find` server-side. Es barato (cartera ≤ pocos cientos en piloto).
 *  - Historial de cotizaciones (`listarCotizaciones`) — leemos hasta 50
 *    del tenant y filtramos por `c.rfc === rfc` server-side.
 *
 * SECURITY:
 *  - El RFC viene de URL (params) → validar con `RFC_REGEX`. Si no
 *    matchea, 404.
 *  - `tenant_id` viene del HMAC firmado de la sesión; jamás del cliente.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";
import { listarCotizaciones } from "@/lib/cotizaciones";
import type { Cotizacion } from "@/types/cotizacion";
import { RFC_REGEX } from "@/types/cotizacion";
import { Sidebar } from "@/components/admin/Sidebar";
import { FolderOpen, ArrowRight } from "lucide-react";
import { KpiCardSpark, TimelineList } from "./_client";

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";
const FETCH_LIMIT = 50;

interface ClienteEnCartera {
  rfc: string;
  nombre: string;
  [key: string]: unknown;
}

interface ClientesResponse {
  clientes?: ClienteEnCartera[];
  total?: number;
  fecha_actualizacion?: string | null;
}

interface PageProps {
  // Next 16: params es Promise.
  params: Promise<{ rfc: string }>;
}

async function fetchClienteByRfc(
  tenantId: string | number,
  rfc: string
): Promise<ClienteEnCartera | null> {
  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(tenantId);
  } catch (e) {
    console.error("[cliente/[rfc]] sign error", e);
    return null;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BOT_API_URL}/api/v1/clientes`, {
      method: "GET",
      headers: { ...authHeader, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[cliente/[rfc]] backend fetch error", e);
    return null;
  }

  if (!upstream.ok) return null;

  let data: ClientesResponse;
  try {
    data = (await upstream.json()) as ClientesResponse;
  } catch {
    return null;
  }

  const list = data.clientes ?? [];
  return list.find((c) => c.rfc?.toUpperCase() === rfc) ?? null;
}

/**
 * Construye una serie sintética estable de 12 puntos para el sparkline a partir
 * del valor real. Sin Math.random para no romper hidratación SSR. La curva
 * "rima" con el dato (sube si target > 0).
 */
function buildSparkSeries(target: number, points = 12): number[] {
  if (target <= 0) return Array(points).fill(0);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1); // 0..1
    // curva suave 0.4 → 1.0 del target con un pequeño bumpy estable.
    const base = 0.4 + 0.6 * t;
    const wiggle = Math.sin(i * 1.7) * 0.06;
    out.push(target * (base + wiggle));
  }
  return out;
}

export default async function ClienteDetallePage({ params }: PageProps) {
  const session = await getSession();
  const { rfc: rfcRaw } = await params;
  const rfc = decodeURIComponent(rfcRaw).toUpperCase();

  // Validar formato RFC antes de tocar backend.
  if (!RFC_REGEX.test(rfc)) {
    notFound();
  }

  // Paralelo: cliente + historial.
  const [cliente, cotizacionesResult] = await Promise.all([
    fetchClienteByRfc(session.tenant_id, rfc),
    listarCotizaciones(session.tenant_id, { limit: FETCH_LIMIT, offset: 0 }),
  ]);

  // Filtro client-side (en server) por rfc.
  const cotizacionesCliente: Cotizacion[] = cotizacionesResult.ok
    ? cotizacionesResult.data.cotizaciones.filter(
        (c) => (c.rfc ?? "").toUpperCase() === rfc
      )
    : [];

  // Si el RFC no aparece en cartera Y no tiene cotizaciones, 404.
  if (!cliente && cotizacionesCliente.length === 0 && cotizacionesResult.ok) {
    notFound();
  }

  const nombreMostrar = cliente?.nombre ?? "Cliente sin nombre en cartera";

  // KPIs derivados (no inventamos: sólo sumamos lo que tenemos en el listado).
  const totalCot = cotizacionesCliente.length;
  const completadas = cotizacionesCliente.filter(
    (c) => c.estado === "completada"
  );
  const montoTotal = completadas.reduce(
    (acc, c) => acc + c.lineas * c.plan,
    0
  );
  const lineasTotales = completadas.reduce((acc, c) => acc + c.lineas, 0);

  // Series sintéticas estables (anti hydration mismatch).
  const cotSeries = buildSparkSeries(completadas.length);
  const montoSeries = buildSparkSeries(Math.max(1, Math.round(montoTotal / 1000)));
  const lineasSeries = buildSparkSeries(lineasTotales);

  // Sidebar identity.
  const initials = String(session.vendedor_id).slice(0, 2).toUpperCase();
  const userLabel = `Vendedor #${session.vendedor_id}`;
  const userSubtitle = `Distribuidor ${session.tenant_id}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar
        active="clientes"
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
            <Link
              href="/dashboard/clientes"
              className="hover:text-indigo-600 transition"
            >
              Mis clientes
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-mono text-xs font-semibold">
              {rfc}
            </span>
          </div>

          {/* Header card */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 md:p-8 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-4 flex-wrap">
                  <div
                    aria-hidden="true"
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 text-white font-extrabold flex items-center justify-center text-base shrink-0 shadow-sm"
                  >
                    {initialsFromNombre(nombreMostrar)}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                      {nombreMostrar}
                    </h1>
                    <p className="font-mono text-xs md:text-sm text-cyan-600 font-semibold mt-1">
                      {rfc}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mt-4">
                  {totalCot === 0
                    ? "Sin cotizaciones registradas aún."
                    : `${totalCot} ${totalCot === 1 ? "cotización registrada" : "cotizaciones registradas"}${
                        !cotizacionesResult.ok ? " (datos parciales)" : ""
                      }.`}
                </p>
              </div>
              <Link
                href={`/dashboard/cotizar?rfc=${encodeURIComponent(rfc)}`}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition"
              >
                Cotizar para este cliente
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* KPI cards con NumberFlow + Recharts sparkline */}
          {totalCot > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <KpiCardSpark
                label="Cotizaciones completadas"
                value={completadas.length}
                format="int"
                hint={
                  totalCot > completadas.length
                    ? `${totalCot - completadas.length} en proceso o fallidas`
                    : "Todas las del cliente"
                }
                series={cotSeries}
                delta={completadas.length > 0 ? `+${completadas.length}` : undefined}
                deltaTone="emerald"
              />
              <KpiCardSpark
                label="Monto mensual acumulado"
                value={montoTotal}
                format="mxn"
                hint="Suma de líneas × plan en completadas"
                series={montoSeries}
                deltaTone="indigo"
              />
              <KpiCardSpark
                label="Líneas cotizadas"
                value={lineasTotales}
                format="int"
                hint="Total entre todas las completadas"
                series={lineasSeries}
                deltaTone="emerald"
              />
            </dl>
          )}

          {!cotizacionesResult.ok && (
            <div
              role="alert"
              className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4"
            >
              <p className="text-rose-700 font-semibold text-sm">
                No pudimos cargar el historial de cotizaciones.
              </p>
              <p className="text-sm text-rose-600 mt-1">
                {cotizacionesResult.message}
              </p>
            </div>
          )}

          {cotizacionesResult.ok && cotizacionesCliente.length === 0 ? (
            <EmptyState rfc={rfc} />
          ) : cotizacionesCliente.length > 0 ? (
            <section
              aria-label="Historial de cotizaciones"
              className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 md:p-8"
            >
              <h2 className="text-xl font-extrabold text-slate-900 mb-6 tracking-tight">
                Línea de tiempo
              </h2>
              <TimelineList rows={cotizacionesCliente} />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/* ---------- Helpers ---------- */

function initialsFromNombre(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ---------- Empty ---------- */

function EmptyState({ rfc }: { rfc: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 md:p-14 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center ring-8 ring-indigo-50/50">
        <FolderOpen className="w-10 h-10 text-indigo-500" />
      </div>
      <h2 className="mt-6 text-2xl font-extrabold text-slate-900 tracking-tight">
        Aún no hay cotizaciones para este RFC
      </h2>
      <p className="mt-2 text-slate-600 max-w-md mx-auto text-sm leading-relaxed">
        Crea la primera y aparecerá aquí en cuanto el bot termine de generar el
        PDF.
      </p>
      <div className="mt-6">
        <Link
          href={`/dashboard/cotizar?rfc=${encodeURIComponent(rfc)}`}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition inline-flex items-center gap-2"
        >
          Crear primera cotización <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
