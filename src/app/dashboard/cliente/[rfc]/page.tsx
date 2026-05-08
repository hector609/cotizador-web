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
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";
import { listarCotizaciones } from "@/lib/cotizaciones";
import type { Cotizacion, EstadoCotizacion } from "@/types/cotizacion";
import { RFC_REGEX } from "@/types/cotizacion";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";

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

  // Filtro client-side (en server) por rfc. El backend devuelve todas las
  // del tenant, nosotros nos quedamos con las de este RFC.
  const cotizacionesCliente: Cotizacion[] = cotizacionesResult.ok
    ? cotizacionesResult.data.cotizaciones.filter(
        (c) => (c.rfc ?? "").toUpperCase() === rfc
      )
    : [];

  // Si el RFC no aparece en cartera Y no tiene cotizaciones, lo tratamos
  // como "no existe en este tenant" → 404. Si sí tiene cotizaciones pero
  // no aparece en cartera (caso histórico), seguimos mostrando con nombre
  // genérico.
  if (!cliente && cotizacionesCliente.length === 0 && cotizacionesResult.ok) {
    notFound();
  }

  const nombreMostrar = cliente?.nombre ?? "Cliente sin nombre en cartera";
  const totalCotizaciones = cotizacionesCliente.length;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">
            Cotizador Inteligente para DATS
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
              Dashboard
            </Link>
            <Link
              href="/dashboard/clientes"
              className="text-blue-700 font-medium"
            >
              Clientes
            </Link>
            <Link
              href="/dashboard/cotizar"
              className="text-slate-600 hover:text-slate-900"
            >
              Cotizar
            </Link>
            <Link
              href="/dashboard/historial"
              className="text-slate-600 hover:text-slate-900"
            >
              Historial
            </Link>
            <Link href="/" className="text-slate-500 hover:text-slate-700 ml-4">
              Salir
            </Link>
          </nav>
        </div>
      </header>

      <Section bg="slate" spacing="sm" width="wide">
        {/* Breadcrumb */}
        <div className="text-sm text-slate-500 mb-4">
          <Link href="/dashboard/clientes" className="hover:text-slate-900">
            ← Volver a clientes
          </Link>
        </div>

        {/* Header del cliente */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              {nombreMostrar}
            </h2>
            <p className="mt-1 font-mono text-sm text-slate-600">{rfc}</p>
            <p className="mt-2 text-sm text-slate-600">
              <strong className="text-slate-900">{totalCotizaciones}</strong>{" "}
              cotización
              {totalCotizaciones === 1 ? "" : "es"} registrada
              {totalCotizaciones === 1 ? "" : "s"}
              {!cotizacionesResult.ok && " (datos parciales)"}
            </p>
          </div>
          <Link
            href={`/dashboard/cotizar?rfc=${encodeURIComponent(rfc)}`}
            className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
          >
            Cotizar para este cliente
          </Link>
        </div>

        {/* Aviso si la lectura del historial falló */}
        {!cotizacionesResult.ok && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-red-900 font-semibold text-sm">
              No pudimos cargar el historial de cotizaciones.
            </p>
            <p className="text-sm text-red-800 mt-1">
              {cotizacionesResult.message}
            </p>
          </div>
        )}

        {/* Tabla o empty state */}
        {cotizacionesResult.ok && cotizacionesCliente.length === 0 ? (
          <EmptyState rfc={rfc} />
        ) : cotizacionesCliente.length > 0 ? (
          <Tabla rows={cotizacionesCliente} />
        ) : null}
      </Section>
    </main>
  );
}

/* ---------- subcomponents ---------- */

function Tabla({ rows }: { rows: Cotizacion[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Equipo</th>
              <th className="text-right px-4 py-3 font-medium">Plan</th>
              <th className="text-right px-4 py-3 font-medium">Líneas</th>
              <th className="text-right px-4 py-3 font-medium">Total mensual</th>
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

  // Total mensual estimado = lineas * plan. El "total real" lo calcula
  // Telcel en el PDF; aquí mostramos el subtotal mensual del plan para
  // dar contexto rápido sin abrir el PDF.
  const totalMensual = c.lineas * c.plan;

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fechaStr}</td>
      <td className="px-4 py-3 text-slate-700">
        {c.equipo || <span className="text-slate-400">Sin equipo</span>}
      </td>
      <td className="px-4 py-3 text-right text-slate-700">
        ${c.plan.toLocaleString("es-MX")}
      </td>
      <td className="px-4 py-3 text-right text-slate-700">{c.lineas}</td>
      <td className="px-4 py-3 text-right text-slate-900 font-medium">
        ${totalMensual.toLocaleString("es-MX")}
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
          {c.estado === "fallida" && (
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

function EmptyState({ rfc }: { rfc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 md:p-14 text-center">
      <Badge variant="muted" uppercase={false}>
        Sin historial
      </Badge>
      <h3 className="mt-4 text-2xl font-bold text-slate-900">
        Aún no hay cotizaciones para este RFC
      </h3>
      <p className="mt-2 text-slate-600 max-w-md mx-auto">
        Crea la primera y aparecerá aquí en cuanto el bot termine de
        generar el PDF.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href={`/dashboard/cotizar?rfc=${encodeURIComponent(rfc)}`}
          className="px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
        >
          Crear primera cotización ↗
        </Link>
      </div>
    </div>
  );
}
