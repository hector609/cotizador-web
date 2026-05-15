/**
 * GET /api/billing/status
 *
 * Proxy autenticado al bot para obtener el estado de suscripción del tenant.
 * Alias semántico de /api/tenant/subscription — centraliza los campos que
 * necesita /dashboard/billing: subscription_status, subscription_plan,
 * current_period_end, trial_ends_at, stripe_customer_id.
 *
 * Auth: cookie session.
 */

import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

const BOT_API_URL = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";

export interface BillingStatus {
  subscription_plan: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/billing/status] sign error", e);
    return errJson("Error de configuración del servidor.", 500);
  }

  try {
    const resp = await fetch(`${BOT_API_URL}/api/v1/tenant/subscription`, {
      headers: { ...authHeader },
      signal: AbortSignal.timeout(8_000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[api/billing/status] bot error", resp.status, text);
      return errJson("Error al obtener estado de suscripción.", resp.status);
    }

    const data = (await resp.json()) as BillingStatus;

    // Normalizar campos faltantes para que el cliente siempre reciba el shape esperado.
    const out: BillingStatus = {
      subscription_plan: data.subscription_plan ?? null,
      subscription_status: data.subscription_status ?? null,
      current_period_end: data.current_period_end ?? null,
      trial_ends_at: data.trial_ends_at ?? null,
      stripe_customer_id: data.stripe_customer_id ?? null,
      stripe_subscription_id: data.stripe_subscription_id ?? null,
    };

    return NextResponse.json(out);
  } catch (e) {
    console.error("[api/billing/status] fetch error", e);
    return errJson("Error de conexión con el servidor.", 502);
  }
}
