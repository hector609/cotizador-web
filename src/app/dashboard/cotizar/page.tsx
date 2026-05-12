import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ChatInterface } from "@/components/chat/ChatInterface";

/**
 * /dashboard/cotizar — chat UI conversacional.
 *
 * Reemplaza el wizard multi-paso anterior (que el owner detesta) por una
 * conversación con el agente Claude. Toda la lógica vive en client-side; este
 * Server Component solo:
 *   1. Verifica la sesión (redirige a /login si no hay).
 *   2. Renderiza la barra de navegación superior consistente con el resto
 *      del dashboard.
 *   3. Monta `<ChatInterface />`.
 *
 * El wizard antiguo sigue disponible en `/dashboard/cotizar-old` (incluido
 * el modo "Subir Excel"). Cuando el chat esté maduro se puede borrar.
 */

export default async function CotizarPage() {
  await getSession();
  return (
    <main className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
            Cotizador Inteligente para DATS
          </h1>
          <nav className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <Link
              href="/dashboard"
              className="text-slate-600 hover:text-slate-900"
            >
              Inicio
            </Link>
            <Link
              href="/dashboard/cotizar"
              className="text-blue-700 font-medium"
            >
              Cotizar
            </Link>
            <Link
              href="/dashboard/historial"
              className="text-slate-600 hover:text-slate-900 hidden sm:inline"
            >
              Historial
            </Link>
            <Link
              href="/dashboard/clientes"
              className="text-slate-600 hover:text-slate-900 hidden sm:inline"
            >
              Clientes
            </Link>
            <Link
              href="/"
              className="text-slate-500 hover:text-slate-700"
              title="Cerrar sesión"
            >
              Salir
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatInterface />
      </div>
    </main>
  );
}
