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
 *    soporta filtro por rfc en el endpoint listar.
 *
 * SECURITY:
 *  - El RFC viene de URL (params) → validar con `RFC_REGEX` antes de
 *    confiar para querys / display. Si no matchea, 404.
 *  - `tenant_id` viene del HMAC firmado de la sesión; jamás del cliente.
 *
 * REDISEÑO "REVENTAR mode" — dark glassmorphism premium. Hooks y data
 * fetching INTACTOS; capa visual nueva.
 *
 * Diseño: header con nombre + RFC mono cyan + 3 KPI cards arriba; abajo
 * timeline vertical de cotizaciones (dot color por estado + hairline
 * divider izquierdo).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";
import { listarCotizaciones } from "@/lib/cotizaciones";
import type { Cotizacion, EstadoCotizacion } from "@/types/cotizacion";
import { RFC_REGEX } from "@/types/cotizacion";
import { Sidebar } from "@/components/admin/Sidebar";

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

  // Sidebar identity.
  const initials = String(session.vendedor_id).slice(0, 2).toUpperCase();
  const userLabel = `Vendedor #${session.vendedor_id}`;
  const userSubtitle = `Distribuidor ${session.tenant_id}`;

  return (
    <div className="min-h-screen bg-[#0b1326] text-slate-200 antialiased">
      <Sidebar
        active="clientes"
        initials={initials}
        userLabel={userLabel}
        userSubtitle={userSubtitle}
      />

      <main className="relative lg:ml-64 pt-14 lg:pt-0 min-h-screen overflow-hidden">
        {/* Mesh + grid */}
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
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
            <Link href="/dashboard" className="hover:text-white transition">
              Inicio
            </Link>
            <span className="text-slate-600">/</span>
            <Link
              href="/dashboard/clientes"
              className="hover:text-white transition"
            >
              Mis clientes
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-white font-mono text-xs">{rfc}</span>
          </div>

          {/* Header glassmorphism */}
          <div className="rounded-2xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-6 md:p-8 mb-6 relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute -right-10 -top-10 w-48 h-48 bg-cyan-400/10 blur-3xl rounded-full pointer-events-none"
            />
            <div className="flex items-start justify-between gap-4 flex-wrap relative">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    aria-hidden="true"
                    className="w-12 h-12 rounded-full bg-cyan-400/20 text-cyan-200 font-black flex items-center justify-center text-base shrink-0 border border-cyan-400/30 shadow-[0_0_18px_rgba(34,211,238,0.25)]"
                  >
                    {initialsFromNombre(nombreMostrar)}
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                      {nombreMostrar}
                    </h1>
                    <p className="font-mono text-xs md:text-sm text-cyan-300 mt-1">
                      {rfc}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mt-3">
                  {totalCot === 0
                    ? "Sin cotizaciones registradas aún."
                    : `${totalCot} ${totalCot === 1 ? "cotización registrada" : "cotizaciones registradas"}${
                        !cotizacionesResult.ok ? " (datos parciales)" : ""
                      }.`}
                </p>
              </div>
              <Link
                href={`/dashboard/cotizar?rfc=${encodeURIComponent(rfc)}`}
                className="shrink-0 px-4 py-2 bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_30px_rgba(29,78,216,0.5)] transition"
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
                value={completadas.length.toLocaleString("es-MX")}
                hint={
                  totalCot > completadas.length
                    ? `${totalCot - completadas.length} en proceso o fallidas`
                    : undefined
                }
                icon={<DocumentIcon className="w-8 h-8" />}
              />
              <KpiCard
                label="Monto mensual acumulado"
                value={fmtMxn(montoTotal)}
                hint="Suma de líneas × plan en completadas"
                icon={<DollarIcon className="w-8 h-8" />}
              />
              <KpiCard
                label="Líneas cotizadas"
                value={lineasTotales.toLocaleString("es-MX")}
                hint="Total entre todas las completadas"
                icon={<HashIcon className="w-8 h-8" />}
              />
            </dl>
          )}

          {!cotizacionesResult.ok && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 backdrop-blur-[12px] p-4"
            >
              <p className="text-red-200 font-semibold text-sm">
                No pudimos cargar el historial de cotizaciones.
              </p>
              <p className="text-sm text-red-300/80 mt-1">
                {cotizacionesResult.message}
              </p>
            </div>
          )}

          {cotizacionesResult.ok && cotizacionesCliente.length === 0 ? (
            <EmptyState rfc={rfc} />
          ) : cotizacionesCliente.length > 0 ? (
            <Timeline rows={cotizacionesCliente} />
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

/* ---------- KPI ---------- */

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-6 transition-all duration-300 hover:scale-[1.02] hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]">
      {icon && (
        <div
          aria-hidden="true"
          className="absolute top-4 right-4 text-cyan-400/10 group-hover:text-cyan-400/20 transition-colors"
        >
          {icon}
        </div>
      )}
      <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
        {label}
      </dt>
      <dd className="text-3xl md:text-4xl font-black tracking-tighter text-white tabular-nums">
        {value}
      </dd>
      {hint && (
        <p className="mt-2 text-xs text-slate-400 font-medium">{hint}</p>
      )}
    </div>
  );
}

/* ---------- Timeline ---------- */

function Timeline({ rows }: { rows: Cotizacion[] }) {
  // Ordenar por fecha desc — el más reciente arriba.
  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at).getTime() || 0;
    const tb = new Date(b.created_at).getTime() || 0;
    return tb - ta;
  });

  return (
    <section
      aria-label="Historial de cotizaciones"
      className="rounded-2xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-6 md:p-8"
    >
      <h2 className="text-xl font-bold text-white mb-6">
        Línea de tiempo
      </h2>
      <ol className="relative" role="list">
        {/* Hairline divider izquierdo */}
        <span
          aria-hidden="true"
          className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10"
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

  // Color del dot por estado; "más reciente" añade ring cyan + glow.
  const dotBase = "absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full";
  const dotColor =
    c.estado === "completada"
      ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
      : c.estado === "pendiente"
        ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]"
        : "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.7)]";
  const dotRing = mostRecent
    ? "ring-4 ring-cyan-400/30"
    : "";
  const folio = c.id.length > 8 ? c.id.slice(0, 8).toUpperCase() : c.id;

  return (
    <li className="relative pl-8 pb-6 last:pb-0">
      <span aria-hidden="true" className={`${dotBase} ${dotColor} ${dotRing}`} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-xs text-cyan-300">{folio}</p>
            <EstadoBadge estado={c.estado} />
            {mostRecent && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                Más reciente
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300 mt-2">
            {c.equipo || (
              <span className="text-slate-500 italic">Sin equipo</span>
            )}
            <span className="text-slate-600 mx-1.5">·</span>
            <span className="text-slate-400">
              {c.lineas} {c.lineas === 1 ? "línea" : "líneas"} ×{" "}
              {fmtMxn(c.plan)}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {fechaStr}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl md:text-2xl font-black text-white tabular-nums">
            {fmtMxn(totalMensual)}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-0.5">
            renta mensual
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {c.estado === "completada" && c.pdf_url && (
          <a
            href={c.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-medium rounded-md hover:bg-cyan-500/25 hover:border-cyan-400/50 transition"
            aria-label={`Descargar PDF cliente de cotización ${c.id}`}
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            PDF cliente
          </a>
        )}
        {c.estado === "completada" && c.pdf_url_interno && (
          <a
            href={c.pdf_url_interno}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/10 text-slate-300 text-xs font-medium rounded-md hover:bg-white/10 transition"
            aria-label={`Descargar PDF interno de cotización ${c.id}`}
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            PDF interno
          </a>
        )}
        {c.estado === "fallida" && (
          <Link
            href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/10 text-slate-200 text-xs font-medium rounded-md hover:bg-white/10 transition"
          >
            Reintentar →
          </Link>
        )}
        {c.estado === "pendiente" && (
          <span className="text-xs text-amber-300 italic">En proceso…</span>
        )}
      </div>
    </li>
  );
}

/* ---------- Badge ---------- */

function EstadoBadge({ estado }: { estado: EstadoCotizacion }) {
  if (estado === "completada") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
        Completada
      </span>
    );
  }
  if (estado === "pendiente") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-400/10 text-red-300 border border-red-400/30 uppercase tracking-wider">
      Falló
    </span>
  );
}

/* ---------- Empty ---------- */

function EmptyState({ rfc }: { rfc: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] backdrop-blur-[12px] border border-white/10 p-10 md:p-14 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
        <FolderEmptyIcon className="w-8 h-8 text-cyan-300" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-white">
        Aún no hay cotizaciones para este RFC
      </h2>
      <p className="mt-2 text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
        Crea la primera y aparecerá aquí en cuanto el bot termine de generar el
        PDF.
      </p>
      <div className="mt-6">
        <Link
          href={`/dashboard/cotizar?rfc=${encodeURIComponent(rfc)}`}
          className="px-5 py-2.5 bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_20px_rgba(29,78,216,0.3)] hover:shadow-[0_0_30px_rgba(29,78,216,0.5)] transition inline-flex items-center gap-2"
        >
          Crear primera cotización <ArrowRightIcon className="w-4 h-4" />
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

function DocumentIcon({ className = "w-8 h-8" }: { className?: string }) {
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

function DollarIcon({ className = "w-8 h-8" }: { className?: string }) {
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

function HashIcon({ className = "w-8 h-8" }: { className?: string }) {
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
        d="M5.25 8.25h15m-15 7.5h15M8.5 3l-2 18m11-18l-2 18"
      />
    </svg>
  );
}
