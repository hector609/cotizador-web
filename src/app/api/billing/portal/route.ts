/**
 * GET /api/billing/portal
 *
 * Redirige al tenant al Stripe Customer Portal para gestionar su suscripción
 * (cambiar plan, actualizar tarjeta, ver facturas, cancelar).
 *
 * Auth: cookie session (vendedor autenticado).
 * Requiere que el tenant tenga stripe_customer_id (suscripción activa).
 *
 * Flow:
 *  1. Verifica sesión.
 *  2. Llama al bot para obtener stripe_customer_id del tenant.
 *  3. Crea Billing Portal Session via Stripe API.
 *  4. Redirige al user a la URL devuelta por Stripe.
 *
 * Env vars requeridas:
 *   STRIPE_SECRET_KEY   — sk_live_xxx o sk_test_xxx
 *   NEXT_PUBLIC_APP_URL — URL de retorno después del portal
 *   BOT_API_URL         — para obtener el stripe_customer_id del tenant
 *   WEBHOOK_SECRET      — para autenticar con el bot
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const APP_URL           = process.env.NEXT_PUBLIC_APP_URL ?? "https://cotizador.hectoria.mx";
const BOT_API_URL       = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";
const WEBHOOK_SECRET    = process.env.WEBHOOK_SECRET ?? "";

async function getStripeCustomerId(tenantId: string, distribuidorId: number): Promise<string | null> {
  try {
    const auth = signBackendRequest(distribuidorId);
    const resp = await fetch(
      `${BOT_API_URL}/api/v1/tenant/subscription`,
      {
        headers: { ...auth },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { stripe_customer_id?: string | null };
    return data.stripe_customer_id ?? null;
  } catch {
    return null;
  }
}

/** Crea una Billing Portal Session y devuelve la URL. */
async function createPortalSession(customerId: string): Promise<{ url: string } | { error: string; status: number }> {
  const params = new URLSearchParams({
    customer: customerId,
    return_url: `${APP_URL}/dashboard/billing`,
  });

  const stripeResp = await fetch(
    "https://api.stripe.com/v1/billing_portal/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!stripeResp.ok) {
    const errData = await stripeResp.json().catch(() => ({}));
    const errMsg =
      (errData as { error?: { message?: string } }).error?.message ??
      `Stripe error ${stripeResp.status}`;
    console.error("[billing/portal] Stripe error:", errMsg);
    return { error: errMsg, status: 502 };
  }

  const portalSession = (await stripeResp.json()) as { url?: string };
  if (!portalSession.url) {
    return { error: "Stripe no devolvió URL", status: 502 };
  }
  return { url: portalSession.url };
}

/**
 * GET /api/billing/portal — Redirige directamente al Customer Portal (navegación directa).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 500 });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const customerId = await getStripeCustomerId(session.tenant_id, session.distribuidor_id);
  if (!customerId) {
    return NextResponse.redirect(new URL("/precios", req.url));
  }

  try {
    const result = await createPortalSession(customerId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.redirect(result.url);
  } catch (err) {
    console.error("[billing/portal] GET error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/billing/portal — Devuelve { url } JSON para que el cliente haga
 * el redirect desde JS (útil en botones que necesitan feedback de carga).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 500 });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const customerId = await getStripeCustomerId(session.tenant_id, session.distribuidor_id);
  if (!customerId) {
    return NextResponse.json({ error: "No tienes una suscripción activa en Stripe." }, { status: 404 });
  }

  try {
    const result = await createPortalSession(customerId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error("[billing/portal] POST error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
