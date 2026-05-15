/**
 * POST /api/billing/create-checkout-session
 *
 * Crea una Stripe Checkout Session para que el tenant haga upgrade de plan.
 *
 * Auth: cookie session (vendedor autenticado — cualquier rol).
 * Body: { plan_id: string }  — el Price ID de Stripe (ej. "price_1Abc...").
 *
 * Response 200: { url: string } — URL de Stripe Checkout para redirect.
 * Response 400: { error: string }
 * Response 401: sin sesión
 * Response 500: error interno
 *
 * Env vars requeridas:
 *   STRIPE_SECRET_KEY        — sk_live_xxx o sk_test_xxx
 *   NEXT_PUBLIC_APP_URL      — https://cotizador.hectoria.mx (para success/cancel URLs)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cotizador.hectoria.mx";

// Price IDs por plan. Setear en .env.local / Vercel env vars.
const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  starter:         process.env.STRIPE_PRICE_STARTER,
  pro:             process.env.STRIPE_PRICE_PRO,
  empresa:         process.env.STRIPE_PRICE_EMPRESA,
  vendedor_telcel: process.env.STRIPE_PRICE_VENDEDOR_TELCEL,
};

export async function POST(req: NextRequest) {
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 500 });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  }

  let body: { plan_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos. Verifica los campos e intenta de nuevo." }, { status: 400 });
  }

  const { plan_id } = body;
  if (!plan_id) {
    return NextResponse.json({ error: "plan_id requerido" }, { status: 400 });
  }

  // Buscar price_id por nombre del plan o usar el valor directo si es un Price ID.
  const priceId: string | undefined =
    PLAN_PRICE_MAP[plan_id.toLowerCase()] ??
    (plan_id.startsWith("price_") ? plan_id : undefined);

  if (!priceId) {
    return NextResponse.json(
      { error: `Plan desconocido: ${plan_id}. Usa starter, pro, empresa o vendedor_telcel.` },
      { status: 400 }
    );
  }

  const tenantId = session.tenant_id;

  try {
    // Llamada directa a la API REST de Stripe (sin SDK para no agregar dep).
    const params = new URLSearchParams({
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      mode: "subscription",
      // P0-2: Forzar moneda MXN y locale es-MX para la UI de Stripe Checkout.
      // Nota: el currency del Price object en Stripe Dashboard también debe ser
      // MXN. Si el Price ya tiene currency definida, Stripe la respeta —
      // currency aquí actúa como validación adicional (Stripe rechazará si no coincide).
      currency: "mxn",
      locale: "es-MX",
      // Métodos de pago: tarjeta + OXXO (voucher en efectivo 72h).
      "payment_method_types[0]": "card",
      "payment_method_types[1]": "oxxo",
      // OXXO voucher expira 3 días naturales.
      "payment_method_options[oxxo][expires_after_days]": "3",
      // Los precios YA incluyen IVA 16% — Stripe NO debe agregarlo encima.
      "automatic_tax[enabled]": "false",
      success_url: `${APP_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${APP_URL}/dashboard/billing?checkout=canceled`,
      // Metadatos para asociar la sesión al tenant en el webhook.
      "metadata[tenant_id]": tenantId,
      "subscription_data[metadata][tenant_id]": tenantId,
      // Trial ya manejado en backend — no agregar trial period aquí
      // para no duplicar si ya existe uno.
      // RFC/Tax ID collection para facturación — México.
      "tax_id_collection[enabled]": "true",
      "customer_creation": "always",
      "billing_address_collection": "required",
      "phone_number_collection[enabled]": "true",
      "consent_collection[terms_of_service]": "required",
    });

    const stripeResp = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
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
      console.error("[billing/create-checkout-session] Stripe error:", errMsg);
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const checkoutSession = (await stripeResp.json()) as { url?: string };
    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe no devolvió URL" }, { status: 502 });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[billing/create-checkout-session] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
