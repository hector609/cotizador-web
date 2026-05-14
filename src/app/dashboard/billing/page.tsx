/**
 * /dashboard/billing — Server Component wrapper que impone role === "admin" (P1-5).
 *
 * Si la sesión no existe → redirect /login (via getSession).
 * Si el role no es "admin" → redirect /dashboard.
 * Si pasa ambos checks → renderiza el Client Component de facturación.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import BillingPageClient from "./_BillingPageClient";

export default async function BillingPage() {
  const session = await getSession(); // redirige a /login si no hay sesión

  if (session.role !== "admin") {
    redirect("/dashboard");
  }

  return <BillingPageClient />;
}
