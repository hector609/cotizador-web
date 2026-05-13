/**
 * /dashboard layout — wrapper minimalista que monta `<AriaCopilot />`
 * globalmente para TODAS las rutas /dashboard/*.
 *
 * Cada página hija sigue montando su propio `<Sidebar />` (patrón pre-existente
 * que no rompemos). Aquí solo añadimos el copilot flotante.
 *
 * NOTA: NO usamos getSession() aquí — cada página hija ya redirige al /login
 * si la cookie falta. El AriaCopilot es client-side y degrada gracefully si
 * /api/copilot devuelve 401.
 */

import { getSessionOrNull } from "@/lib/auth";
import AriaCopilot from "@/components/copilot/AriaCopilot";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Best-effort: pasar el vendedor_id al copilot para personalizar el saludo.
  // Si no hay sesión, el copilot igual se monta pero las llamadas a /api/copilot
  // devolverán 401 (el user verá un error legible al intentar enviar).
  const session = await getSessionOrNull();
  const userName = session ? `Vendedor #${session.vendedor_id}` : undefined;

  return (
    <>
      {children}
      <AriaCopilot userName={userName} />
    </>
  );
}
