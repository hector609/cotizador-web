/**
 * POST /api/billing/webhook
 *
 * Recibe webhooks de Stripe, verifica la firma y actualiza el estado de
 * suscripción del tenant en el bot vía POST /api/v1/admin/tenants/<id>/subscription.
 *
 * Eventos manejados:
 *   customer.subscription.created  → active / trialing
 *   customer.subscription.updated  → sync plan + período
 *   customer.subscription.deleted  → canceled
 *   invoice.paid                   → confirmar active + nueva fecha de fin
 *   invoice.payment_failed         → past_due
 *
 * Env vars requeridas:
 *   STRIPE_SECRET_KEY       — para llamadas a Stripe API
 *   STRIPE_WEBHOOK_SECRET   — whsec_xxx para verificar firma
 *   BOT_API_URL             — https://cmdemobot.fly.dev
 *   WEBHOOK_SECRET          — secret compartido con el bot Python
 *
 * IMPORTANTE: Esta ruta debe configurarse como webhook en el Stripe Dashboard
 * apuntando a https://cotizador.hectoria.mx/api/billing/webhook.
 * En local: usa `stripe listen --forward-to localhost:3000/api/billing/webhook`.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const STRIPE_SECRET_KEY    = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const BOT_API_URL          = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";
const WEBHOOK_SECRET       = process.env.WEBHOOK_SECRET ?? "";

// Mapa de Price ID → nombre de plan (se llena desde env vars para evitar
// hardcodear IDs en el código).
function getPlanFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_EMPRESA) return "empresa";
  return "starter"; // fallback conservador
}

// ============================================================
// Verificación de firma Stripe (sin SDK)
// ============================================================

function verifyStripeSignature(payload: string, sigHeader: string, secret: string): boolean {
  if (!secret) return false;
  try {
    // Stripe-Signature: t=<ts>,v1=<sig>,v1=<sig2>,...
    const parts = sigHeader.split(",");
    const tPart = parts.find((p) => p.startsWith("t="));
    const v1Parts = parts.filter((p) => p.startsWith("v1="));
    if (!tPart || v1Parts.length === 0) return false;

    const timestamp = tPart.slice(2);
    const signedPayload = `${timestamp}.${payload}`;

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");

    // Comparar contra todas las firmas v1 presentes.
    return v1Parts.some((v1) => {
      const incoming = v1.slice(3);
      if (expectedSig.length !== incoming.length) return false;
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expectedSig, "hex"),
          Buffer.from(incoming, "hex")
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// ============================================================
// Helper: extrae tenant_id del objeto Stripe
// ============================================================

function extractTenantId(obj: StripeObject): string | null {
  return (
    obj.metadata?.tenant_id ??
    obj.subscription_data?.metadata?.tenant_id ??
    null
  );
}

// ============================================================
// Helper: llama al bot para actualizar suscripción
// ============================================================

async function updateBotSubscription(tenantId: string, fields: Record<string, unknown>): Promise<void> {
  const url = `${BOT_API_URL}/api/v1/admin/tenants/${tenantId}/subscription`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
    body: JSON.stringify(fields),
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Bot responded ${resp.status}: ${text.slice(0, 200)}`);
  }
}

// ============================================================
// Helper: obtiene primer item de una suscripción Stripe
// ============================================================

function getFirstPriceId(subscription: StripeSubscription): string | null {
  try {
    return subscription.items?.data?.[0]?.price?.id ?? null;
  } catch {
    return null;
  }
}

function periodEndToIso(ts: number | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

// ============================================================
// Tipos mínimos de Stripe (sin SDK)
// ============================================================

interface StripeMetadata {
  tenant_id?: string;
  [key: string]: string | undefined;
}

interface StripeObject {
  id: string;
  metadata?: StripeMetadata;
  subscription_data?: { metadata?: StripeMetadata };
  [key: string]: unknown;
}

interface StripeSubscription extends StripeObject {
  status: string;
  customer: string;
  current_period_end?: number;
  items?: { data?: Array<{ price?: { id?: string } }> };
  cancel_at_period_end?: boolean;
}

interface StripeInvoice extends StripeObject {
  subscription?: string;
  customer?: string;
  lines?: { data?: Array<{ price?: { id?: string } }> };
}

interface StripeEvent {
  type: string;
  data: { object: StripeObject };
}

// ============================================================
// Handler principal
// ============================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  // 1) Verificar firma
  if (STRIPE_WEBHOOK_SECRET) {
    if (!verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET)) {
      console.warn("[billing/webhook] Firma Stripe inválida");
      return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
    }
  } else {
    console.warn("[billing/webhook] STRIPE_WEBHOOK_SECRET no configurado — omitiendo verificación");
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { type, data } = event;
  const obj = data.object;

  console.log(`[billing/webhook] evento: ${type}`);

  try {
    switch (type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = obj as StripeSubscription;
        const tenantId = extractTenantId(sub);
        if (!tenantId) {
          console.warn("[billing/webhook] subscription sin tenant_id en metadata:", sub.id);
          break;
        }
        const priceId = getFirstPriceId(sub);
        const plan = priceId ? getPlanFromPriceId(priceId) : "starter";
        const status = sub.status === "trialing" ? "trialing" : "active";
        await updateBotSubscription(tenantId, {
          subscription_plan: plan,
          subscription_status: status,
          current_period_end: periodEndToIso(sub.current_period_end as number | undefined),
          stripe_customer_id: String(sub.customer),
          stripe_subscription_id: sub.id,
        });
        console.log(`[billing/webhook] tenant=${tenantId} → plan=${plan} status=${status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = obj as StripeSubscription;
        const tenantId = extractTenantId(sub);
        if (!tenantId) break;
        await updateBotSubscription(tenantId, {
          subscription_status: "canceled",
          subscription_plan: "expired",
          current_period_end: periodEndToIso(sub.current_period_end as number | undefined),
          stripe_subscription_id: sub.id,
        });
        console.log(`[billing/webhook] tenant=${tenantId} → canceled`);
        break;
      }

      case "invoice.paid": {
        const inv = obj as StripeInvoice;
        // Buscar tenant_id en la suscripción asociada.
        if (!inv.subscription || !inv.customer) break;
        // Obtener suscripción para leer metadata.
        const subResp = await fetch(
          `https://api.stripe.com/v1/subscriptions/${inv.subscription}`,
          { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
        );
        if (!subResp.ok) break;
        const sub = (await subResp.json()) as StripeSubscription;
        const tenantId = extractTenantId(sub);
        if (!tenantId) break;
        const priceId = getFirstPriceId(sub);
        const plan = priceId ? getPlanFromPriceId(priceId) : "starter";
        await updateBotSubscription(tenantId, {
          subscription_plan: plan,
          subscription_status: "active",
          current_period_end: periodEndToIso(sub.current_period_end as number | undefined),
          stripe_customer_id: String(inv.customer),
          stripe_subscription_id: sub.id,
        });
        console.log(`[billing/webhook] invoice.paid tenant=${tenantId} → active`);
        break;
      }

      case "invoice.payment_failed": {
        const inv = obj as StripeInvoice;
        if (!inv.subscription) break;
        const subResp = await fetch(
          `https://api.stripe.com/v1/subscriptions/${inv.subscription}`,
          { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
        );
        if (!subResp.ok) break;
        const sub = (await subResp.json()) as StripeSubscription;
        const tenantId = extractTenantId(sub);
        if (!tenantId) break;
        await updateBotSubscription(tenantId, {
          subscription_status: "past_due",
          stripe_subscription_id: sub.id,
        });
        console.log(`[billing/webhook] invoice.payment_failed tenant=${tenantId} → past_due`);
        break;
      }

      default:
        // Eventos no manejados: ignorar con 200.
        break;
    }
  } catch (err) {
    console.error(`[billing/webhook] error procesando ${type}:`, err);
    // Devolvemos 200 para que Stripe no reintente indefinidamente.
    // El error ya está logueado.
  }

  return NextResponse.json({ received: true });
}
