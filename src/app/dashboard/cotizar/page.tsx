import { getSession } from "@/lib/auth";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { DashboardNav } from "../_nav";

/**
 * /dashboard/cotizar — chat UI conversacional.
 *
 * Reemplaza el wizard multi-paso anterior (que el owner detesta) por una
 * conversación con el agente Claude. Toda la lógica vive en client-side; este
 * Server Component solo:
 *   1. Verifica la sesión (redirige a /login si no hay).
 *   2. Renderiza la nav unificada del dashboard.
 *   3. Monta `<ChatInterface />`.
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
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatInterface />
      </div>
    </main>
  );
}
