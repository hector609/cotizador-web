import { getSession } from "@/lib/auth";
import { CotizarLayout } from "@/components/chat/CotizarLayout";
import { Sidebar } from "@/components/admin/Sidebar";
import { TrialBanner } from "@/components/admin/TrialBanner";
import { QuickPayButton } from "@/components/billing/QuickPayButton";

/**
 * /dashboard/cotizar — chat UI conversacional + panel lateral de catálogo.
 *
 * REDISEÑO LUMINA Light Premium (pivot 2026-05-13). Pivot total desde
 * "REVENTAR mode" dark glassmorphism: ahora bg-slate-50 + surfaces bg-white
 * con paleta indigo-600 / cyan-500 / pink-500. El Sidebar se reusa del
 * componente compartido (`components/admin/Sidebar.tsx`) — otro agente está
 * re-skineándolo a la misma paleta LUMINA en paralelo.
 *
 * Layout:
 *   1. Verifica la sesión (redirige a /login si no hay).
 *   2. Renderiza el Sidebar fijo izquierdo (componente compartido).
 *   3. Monta `<CotizarLayout />` (chat + catálogo Telcel al lado).
 *
 * El panel lateral muestra el catálogo REAL (planes y equipos) con filtros
 * encadenados, para que el vendedor copie nombres exactos al composer en vez
 * de inventar combos imposibles. La validación server-side sigue siendo el
 * escudo final.
 *
 * La subida de Excel multi-perfil vive en `/dashboard/cotizar-excel`.
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
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar
        active="cotizar"
        initials={initials}
        userLabel={userLabel}
        userSubtitle={userSubtitle}
      />

      {/* Main wrapper: empuja contenido para liberar el sidebar fijo en lg+.
          pt-14 en mobile para no chocar con el top-bar mobile del Sidebar. */}
      <main className="relative lg:ml-64 pt-14 lg:pt-0 min-h-screen flex flex-col overflow-hidden">
        <div className="absolute top-6 right-6 z-40">
          <TrialBanner />
        </div>
        <CotizarLayout />
        <QuickPayButton />
      </main>
    </div>
  );
}
