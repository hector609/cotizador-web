import { getSession } from "@/lib/auth";
import { CotizarLayout } from "@/components/chat/CotizarLayout";
import { Sidebar } from "@/components/admin/Sidebar";

/**
 * /dashboard/cotizar — chat UI conversacional + panel lateral de catálogo.
 *
 * REDISEÑO "REVENTAR mode" (dark glassmorphism premium tipo Linear/Vercel).
 * Adopta el mismo shell que `/dashboard` (Sidebar fijo izquierdo dark, mesh
 * gradient radial top-right, glow cyan en focos). El chat principal queda
 * centrado y el catálogo Telcel a la derecha en `lg+`.
 *
 * Reemplaza el wizard multi-paso anterior (que el owner detesta) por una
 * conversación con el agente Claude. Toda la lógica vive en client-side; este
 * Server Component solo:
 *   1. Verifica la sesión (redirige a /login si no hay).
 *   2. Renderiza el Sidebar fijo dark (sustituye al legacy DashboardNav).
 *   3. Monta `<CotizarLayout />` (chat + catálogo Telcel al lado).
 *
 * El panel lateral muestra el catálogo REAL (planes y equipos) con filtros
 * encadenados, para que el vendedor copie nombres exactos al composer en vez
 * de inventar combos imposibles (e.g. PORTABILIDAD + EMPRESA 9 + 24m +
 * ARRENDAMIENTO) que reventarían la cotización. La validación server-side
 * sigue siendo el escudo final, pero el panel evita que el usuario llegue a
 * armar combinaciones que no existen.
 *
 * La subida de Excel multi-perfil vive en `/dashboard/cotizar-excel` (el
 * único modo del Wizard antiguo que sobrevivió — el resto se borró cuando
 * el chat alcanzó paridad). Owner mide chat vs Excel con telemetría
 * (`/api/telemetry/event`).
 *
 * Handoff desde /dashboard/optimizar: si el vendedor pulsó "Aplicar y
 * cotizar", `ChatInterface` lee `sessionStorage["optimizar:palancas"]` al
 * montar y pre-llena el composer con un prompt incluyendo las palancas.
 */

export default async function CotizarPage() {
  const session = await getSession();

  // Iniciales para el avatar del sidebar — derivadas del vendedor_id ya que
  // la sesión no expone email firmado. Estable y suficiente para decoración.
  const initials = String(session.vendedor_id).slice(0, 2).toUpperCase();
  const userLabel = `Vendedor #${session.vendedor_id}`;
  const userSubtitle = `Distribuidor ${session.tenant_id}`;

  return (
    <div className="min-h-screen bg-[#0b1326] text-slate-200 antialiased">
      <Sidebar
        active="cotizar"
        initials={initials}
        userLabel={userLabel}
        userSubtitle={userSubtitle}
      />

      {/* Main wrapper: empuja contenido para liberar el sidebar fijo en lg+.
          pt-14 en mobile para no chocar con el top-bar mobile del Sidebar. */}
      <main className="relative lg:ml-64 pt-14 lg:pt-0 min-h-screen flex flex-col overflow-hidden">
        <CotizarLayout />
      </main>
    </div>
  );
}
