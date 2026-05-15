/**
 * /dashboard/billing — Gestión de suscripción.
 *
 * Si la sesión no existe → redirect /login (via getSession).
 * Todos los roles (admin, vendedor) pueden ver su suscripción.
 * Los vendedores ven la página en lectura (sin botones de cambio/cancelación).
 */

import { getSession } from "@/lib/auth";
import BillingPageClient from "./_BillingPageClient";

export default async function BillingPage() {
  const session = await getSession(); // redirige a /login si no hay sesión

  return <BillingPageClient isAdmin={session.role === "admin"} />;
}
