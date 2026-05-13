/**
 * /dashboard/cliente/[rfc] — Server Component, vista detalle de un cliente
 * y su historial de cotizaciones.
 *
 * Por qué Server Component: la página es lectura pura. `getSession()`
 * redirige a /login si no hay sesión válida, así que abajo siempre tenemos
 * sesión.
 *
 * Datos:
 *  - Lista de clientes (`${BOT_API_URL}/api/v1/clientes`) — para resolver
 *    el `nombre` del cliente desde el `rfc` que llega por URL. El backend
 *    NO acepta filtro por rfc, así que leemos toda la cartera y hacemos
 *    `find` server-side. Es barato (cartera ≤ pocos cientos en piloto).
 *  - Historial de cotizaciones (`listarCotizaciones`) — leemos hasta 50
 *    del tenant y filtramos por `c.rfc === rfc` server-side. El bot tampoco
 *    soporta filtro por rfc en el endpoint listar (ver bot:6313). Para
 *    cuando un cliente tenga >50 cotizaciones tendremos que extender el
 *    endpoint upstream para aceptar `?rfc=`.
 *
 * SECURITY:
 *  - El RFC viene de URL (params) → validar con `RFC_REGEX` antes de
 *    confiar para querys / display. Si no matchea, 404.
 *  - `tenant_id` viene del HMAC firmado de la sesión; jamás del cliente.
 *
 * Diseño: header con nombre + RFC mono + 3 KPI cards arriba; abajo timeline
 * vertical de cotizaciones (dot azul = más reciente, verde = completadas
 * previas, ámbar = pendientes, rojo = fallidas). Tabla solo cuando hay
 * muchas filas y el usuario quiere ver columnas comparativas — para piloto
 * timeline cubre el caso de uso (auditoría rápida de qué le hemos cotizado).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";
import { listarCotizaciones } from "@/lib/cotizaciones";
import type { Cotizacion, EstadoCotizacion } from "@/types/cotizacion";
import { RFC_REGEX } from "@/types/cotizacion";
import { Section } from "@/components/ui/Section";
import { DashboardNav } from "../../_nav";

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

function fmtMxn(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
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

export default async function ClienteDetallePage({ params }: PageProps) {
  const session = await getSession();
  const { rfc: rfcRaw } = await params;
  const rfc = decodeURIComponent(rfcRaw).toUpperCase();

  // Validar formato RFC antes de tocar backend. Defensa contra inputs
  // como "../foo" o RFCs malformados.
  if (!RFC_REGEX.test(rfc)) {
    notFound();
  }

  // Paralelo: cliente + historial. Ambos van al mismo backend pero a
  // endpoints distintos; lanzamos en paralelo para reducir TTFB.
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

  // Si el RFC no aparece en cartera Y no tiene cotizaciones, lo tratamos
  // como "no existe en este tenant" → 404.
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
  // "AB promedio" no está en el shape de Cotizacion — lo omitimos hasta
  // que el backend lo exponga. Mostramos en su lugar # líneas totales.
  const lineasTotales = completadas.reduce((acc, c) => acc + c.lineas, 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="clientes" />

      <Section bg="slate" spacing="sm" width="wide">
        {/* Breadcrumb */}
        <div className="text-sm mb-4">
          <Link
            href="/dashboard/clientes"
            className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <span aria-hidden="true">←</span> Volver a clientes
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                  {nombreMostrar}
                </h1>
                <span className="font-mono text-xs md:text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                  {rfc}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                {totalCot === 0
                  ? "Sin cotizaciones registradas aún."
                  : `${totalCot} ${totalCot === 1 ? "cotización registrada" : "cotizaciones registradas"}${
                      !cotizacionesResult.ok ? " (datos parciales)" : ""
                    }.`}
              </p>
            </div>
            <Link
              href={`/dashboard/cotizar?rfc=${encodeURIComponent(rfc)}`}
              className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition shadow-md"
            >
              Cotizar para este cliente
            </Link>
          </div>
        </div>

        {/* KPI cards */}
        {totalCot > 0 && (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <KpiCard
              label="Cotizaciones completadas"
              value={String(completadas.length)}
              hint={
                totalCot > completadas.length
                  ? `${totalCot - completadas.length} en proceso o fallidas`
                  : undefined
              }
            />
            <KpiCard
              label="Monto mensual acumulado"
              value={fmtMxn(montoTotal)}
              hint="Suma de líneas × plan en completadas"
            />
            <KpiCard
              label="Líneas cotizadas"
              value={lineasTotales.toLocaleString("es-MX")}
              hint="Total entre todas las completadas"
            />
          </dl>
        )}

        {!cotizacionesResult.ok && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <p className="text-red-900 font-semibold text-sm">
              No pudimos cargar el historial de cotizaciones.
            </p>
            <p className="text-sm text-red-800 mt-1">
              {cotizacionesResult.message}
            </p>
          </div>
        )}

        {cotizacionesResult.ok && cotizacionesCliente.length === 0 ? (
          <EmptyState rfc={rfc} />
        ) : cotizacionesCliente.length > 0 ? (
          <Timeline rows={cotizacionesCliente} />
        ) : null}
      </Section>
    </main>
  );
}

/* ---------- KPI ---------- */

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">
        {value}
      </dd>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

/* ---------- Timeline ---------- */

function Timeline({ rows }: { rows: Cotizacion[] }) {
  // Ordenar por fecha desc para que el más reciente esté arriba — el primero
  // es el "actual" (dot azul); el resto usa color de estado.
  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at).getTime() || 0;
    const tb = new Date(b.created_at).getTime() || 0;
    return tb - ta;
  });

  return (
    <section
      aria-label="Historial de cotizaciones"
      className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8"
    >
      <h2 className="text-lg font-semibold text-slate-900 mb-6">
        Línea de tiempo
      </h2>
      <ol className="relative" role="list">
        {/* Línea vertical */}
        <span
          aria-hidden="true"
          className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200"
        />
        {sorted.map((c, idx) => (
          <TimelineItem key={c.id} c={c} mostRecent={idx === 0} />
        ))}
      </ol>
    </section>
  );
}

function TimelineItem({
  c,
  mostRecent,
}: {
  c: Cotizacion;
  mostRecent: boolean;
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

  const totalMensual = c.lineas * c.plan;

  // Color del dot: el más reciente siempre va azul (ancla visual de "aquí
  // está la actividad reciente"); los anteriores por estado.
  const dotClass = mostRecent
    ? "bg-blue-700 ring-4 ring-blue-100"
    : c.estado === "completada"
      ? "bg-green-500"
      : c.estado === "pendiente"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <li className="relative pl-8 pb-6 last:pb-0">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full ${dotClass}`}
      />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-xs text-slate-600">
              #{c.id.length > 12 ? c.id.slice(0, 12) : c.id}
            </p>
            <EstadoBadge estado={c.estado} />
            {mostRecent && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                Más reciente
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 mt-1">
            {c.equipo || (
              <span className="text-slate-500 italic">Sin equipo</span>
            )}
            {" · "}
            <span className="text-slate-600">
              {c.lineas} {c.lineas === 1 ? "línea" : "líneas"} ×{" "}
              {fmtMxn(c.plan)}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">{fechaStr}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-slate-900 tabular-nums">
            {fmtMxn(totalMensual)}
          </p>
          <p className="text-[10px] text-slate-500">renta mensual</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {c.estado === "completada" && c.pdf_url && (
          <a
            href={c.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-700 hover:underline inline-flex items-center gap-1"
            aria-label={`Descargar PDF cliente de cotización ${c.id}`}
          >
            <DownloadIcon className="w-4 h-4" />
            PDF cliente
          </a>
        )}
        {c.estado === "completada" && c.pdf_url_interno && (
          <a
            href={c.pdf_url_interno}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-slate-700 hover:underline inline-flex items-center gap-1"
            aria-label={`Descargar PDF interno de cotización ${c.id}`}
          >
            <DownloadIcon className="w-4 h-4" />
            PDF interno
          </a>
        )}
        {c.estado === "fallida" && (
          <Link
            href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
            className="text-xs font-medium text-amber-800 hover:underline"
          >
            Reintentar →
          </Link>
        )}
        {c.estado === "pendiente" && (
          <span className="text-xs text-slate-500 italic">En proceso…</span>
        )}
      </div>
    </li>
  );
}

/* ---------- Badge ---------- */

function EstadoBadge({ estado }: { estado: EstadoCotizacion }) {
  if (estado === "completada") {
    return (
      <span className="inline-flex items-center font-semibold rounded-full bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5">
        Completada
      </span>
    );
  }
  if (estado === "pendiente") {
    return (
      <span className="inline-flex items-center font-semibold rounded-full bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5">
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center font-semibold rounded-full bg-red-50 text-red-700 text-[10px] px-2 py-0.5">
      Falló
    </span>
  );
}

/* ---------- Empty ---------- */

function EmptyState({ rfc }: { rfc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 md:p-14 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
        <FolderEmptyIcon className="w-8 h-8 text-slate-400" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-900">
        Aún no hay cotizaciones para este RFC
      </h2>
      <p className="mt-2 text-slate-600 max-w-md mx-auto text-sm leading-relaxed">
        Crea la primera y aparecerá aquí en cuanto el bot termine de generar el
        PDF.
      </p>
      <div className="mt-6">
        <Link
          href={`/dashboard/cotizar?rfc=${encodeURIComponent(rfc)}`}
          className="px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition shadow-md inline-flex items-center gap-2"
        >
          Crear primera cotización <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

/* ---------- Iconos ---------- */

function DownloadIcon({ className = "w-4 h-4" }: { className?: string }) {
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
