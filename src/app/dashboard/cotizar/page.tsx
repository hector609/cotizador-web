import { getSession } from "@/lib/auth";
import { CotizarLayout } from "@/components/chat/CotizarLayout";
import { DashboardNav } from "../_nav";

/**
 * /dashboard/cotizar — chat UI conversacional + panel lateral de catálogo.
 *
 * Reemplaza el wizard multi-paso anterior (que el owner detesta) por una
 * conversación con el agente Claude. Toda la lógica vive en client-side; este
 * Server Component solo:
 *   1. Verifica la sesión (redirige a /login si no hay).
 *   2. Renderiza la nav unificada del dashboard.
 *   3. Monta `<CotizarLayout />` (chat + catálogo Telcel al lado).
 *
 * El panel lateral muestra el catálogo REAL (planes y equipos) con filtros
 * encadenados, para que el vendedor copie nombres exactos al composer en vez
 * de inventar combos imposibles (e.g. PORTABILIDAD + EMPRESA 9 + 24m +
 * ARRENDAMIENTO) que reventarían la cotización. La validación server-side
 * sigue siendo el escudo final, pero el panel evita que el usuario llegue a
 * armar combinaciones que no existen.
 *
 * El H1 corporativo no se repite aquí (lo deja el dashboard home): el header
 * propio del chat ("Nueva cotización") es suficiente.
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
  await getSession();
  return (
    <main className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <DashboardNav active="cotizar" />
      <CotizarLayout />
    </main>
  );
}
