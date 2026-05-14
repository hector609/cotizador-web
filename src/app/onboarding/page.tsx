/**
 * /onboarding — landing del wizard de onboarding.
 *
 * Server Component: lee el estado via GET /api/onboarding/state y redirige
 * al paso correspondiente:
 *   - is_complete == true  → /dashboard
 *   - step == 0            → /onboarding/1
 *   - 1 <= step < 7        → /onboarding/<step>
 *   - step == 7            → /onboarding/7 (confirmación no completada)
 *
 * Si la sesión no existe (cookie ausente/inválida) el proxy devolverá 401
 * y redirigimos a /login.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

const BOT_API_URL = process.env.BOT_API_URL || "https://cmdemobot.fly.dev";

async function fetchOnboardingState(distribuidorId: number): Promise<{
  step: number;
  is_complete: boolean;
} | null> {
  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(distribuidorId);
  } catch {
    return null;
  }

  try {
    const res = await fetch(`${BOT_API_URL}/api/v1/onboarding/state`, {
      method: "GET",
      headers: { ...authHeader, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { step: number; is_complete: boolean };
  } catch {
    return null;
  }
}

export default async function OnboardingLanding() {
  // Verificar sesión (lanza redirect a /login si no existe)
  const session = await getSession();

  // Leer el estado directamente desde backend (Server Component puede llamar
  // al backend con signBackendRequest — no pasa por el cliente).
  const state = await fetchOnboardingState(session.distribuidor_id);

  if (!state) {
    // No se pudo cargar el estado — ir al paso 1 de todas formas.
    redirect("/onboarding/1");
  }

  if (state.is_complete) {
    redirect("/dashboard");
  }

  const targetStep = state.step <= 0 ? 1 : Math.min(state.step, 7);
  redirect(`/onboarding/${targetStep}`);
}
