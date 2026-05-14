"use client";

/**
 * /dashboard/billing — Gestión de suscripción del tenant.
 *
 * LUMINA Light Premium — mismo estilo que el resto del dashboard.
 *
 * Muestra:
 *  - Plan actual + estado + fecha de renovación / vencimiento.
 *  - Botón "Gestionar suscripción" → redirige al Stripe Customer Portal.
 *  - Si plan == trial o expired: CTAs para upgrade.
 *  - Listado de los 3 planes con precios para comparar.
 *
 * Usa fetch client-side a /api/billing/* para acciones.
 * El estado de suscripción se obtiene via /api/tenant/subscription
 * (proxy al bot). Muestra un estado de carga mientras llega.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ---------- Tipos ---------- */

interface SubscriptionInfo {
  subscription_plan: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
}

/* ---------- Constantes de UI ---------- */

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  empresa: "Empresa",
  trial: "Prueba gratuita",
  expired: "Expirado",
};

const PLAN_PRICES: Record<string, number> = {
  starter: 999,
  pro: 2499,
  empresa: 4999,
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Activa", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  trialing: { label: "Período de prueba", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  past_due: { label: "Pago pendiente", color: "text-amber-600 bg-amber-50 border-amber-200" },
  canceled: { label: "Cancelada", color: "text-slate-600 bg-slate-50 border-slate-200" },
  expired: { label: "Expirada", color: "text-red-600 bg-red-50 border-red-200" },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ---------- Hooks ---------- */

function useSubscriptionInfo() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/subscription")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<SubscriptionInfo>;
      })
      .then(setInfo)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { info, loading, error };
}

/* ---------- Componentes ---------- */

function PlanBadge({ plan }: { plan: string | null }) {
  const label = PLAN_LABELS[plan ?? ""] ?? plan ?? "—";
  const isExpired = plan === "expired";
  const isTrial = plan === "trial";
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
        isExpired
          ? "text-red-600 bg-red-50 border-red-200"
          : isTrial
          ? "text-indigo-600 bg-indigo-50 border-indigo-200"
          : "text-emerald-700 bg-emerald-50 border-emerald-200",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const cfg = STATUS_LABELS[status ?? ""] ?? {
    label: status ?? "—",
    color: "text-slate-600 bg-slate-50 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{children}</span>
    </div>
  );
}

function UpgradeCard({
  plan,
  onUpgrade,
  upgrading,
}: {
  plan: string;
  onUpgrade: (plan: string) => void;
  upgrading: string | null;
}) {
  const price = PLAN_PRICES[plan];
  const label = PLAN_LABELS[plan] ?? plan;
  const isFeatured = plan === "pro";
  const isLoading = upgrading === plan;

  return (
    <div
      className={[
        "relative rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-200",
        isFeatured
          ? "border-indigo-400 shadow-lg shadow-indigo-100/50 bg-white"
          : "border-slate-200 bg-white hover:border-indigo-200",
      ].join(" ")}
    >
      {isFeatured && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-[10px] font-bold rounded-full">
          Más popular
        </div>
      )}
      <div>
        <p className="font-bold text-slate-900">{label}</p>
        <p className="text-2xl font-extrabold text-slate-900 mt-1">
          ${price.toLocaleString("es-MX")}
          <span className="text-sm font-normal text-slate-500"> MXN/mes</span>
        </p>
      </div>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => onUpgrade(plan)}
        className={[
          "w-full py-2.5 rounded-full text-sm font-semibold transition-all duration-200",
          isFeatured
            ? "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white hover:opacity-90 shadow-md"
            : "border border-indigo-200 text-indigo-700 hover:bg-indigo-50",
          isLoading ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {isLoading ? "Redirigiendo..." : `Cambiar a ${label}`}
      </button>
    </div>
  );
}

/* ---------- Página principal ---------- */

export default function BillingPage() {
  const { info, loading, error } = useSubscriptionInfo();
  const router = useRouter();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const handleUpgrade = async (plan: string) => {
    setUpgrading(plan);
    setUpgradeError(null);
    try {
      const resp = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plan }),
      });
      const data = (await resp.json()) as { url?: string; error?: string };
      if (!resp.ok) {
        setUpgradeError(data.error ?? `Error ${resp.status}`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      setUpgradeError("Error de red. Intenta de nuevo.");
    } finally {
      setUpgrading(null);
    }
  };

  const handlePortal = () => {
    window.location.href = "/api/billing/portal";
  };

  const plan = info?.subscription_plan ?? null;
  const status = info?.subscription_status ?? null;
  const isActive = status === "active" || status === "trialing";
  const hasStripe = !!info?.stripe_customer_id;
  const showUpgrade = !isActive || plan === "trial" || plan === "expired";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Suscripción</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Gestiona tu plan y facturación
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Checkout feedback */}
        {typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("checkout") === "success" && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-5 py-4 text-sm font-medium">
              Pago exitoso. Tu suscripción está activa. Puede tardar unos segundos en reflejarse.
            </div>
          )}
        {typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("checkout") === "canceled" && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm">
              El pago fue cancelado. Tu plan actual sigue vigente.
            </div>
          )}

        {/* Plan actual */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Plan actual</h2>
          </div>
          <div className="px-6 py-5">
            {loading ? (
              <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
                Cargando info de suscripción...
              </div>
            ) : error ? (
              <div className="text-red-600 text-sm">
                No se pudo cargar la info: {error}
              </div>
            ) : (
              <div className="space-y-1">
                <InfoRow label="Plan">
                  <PlanBadge plan={plan} />
                </InfoRow>
                <InfoRow label="Estado">
                  <StatusBadge status={status} />
                </InfoRow>
                {info?.current_period_end && (
                  <InfoRow
                    label={
                      status === "trialing"
                        ? "Prueba vence"
                        : status === "active"
                        ? "Próxima renovación"
                        : "Fin del período"
                    }
                  >
                    {formatDate(info.current_period_end)}
                  </InfoRow>
                )}
                {info?.trial_ends_at && status === "trialing" && (
                  <InfoRow label="Trial expira">
                    {formatDate(info.trial_ends_at)}
                  </InfoRow>
                )}
              </div>
            )}
          </div>

          {/* Acciones principales */}
          {!loading && !error && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3">
              {hasStripe && (
                <button
                  type="button"
                  onClick={handlePortal}
                  className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors shadow-sm"
                >
                  Gestionar suscripción →
                </button>
              )}
              {!isActive && (
                <Link
                  href="/precios"
                  className="px-5 py-2.5 rounded-full border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition-colors"
                >
                  Ver planes
                </Link>
              )}
              {status === "past_due" && (
                <p className="text-sm text-amber-700 self-center">
                  Hay un pago pendiente. Actualiza tu tarjeta en "Gestionar suscripción".
                </p>
              )}
            </div>
          )}
        </section>

        {/* Upgrade section */}
        {!loading && showUpgrade && (
          <section>
            <h2 className="font-semibold text-slate-900 mb-4">
              {plan === "expired"
                ? "Reactiva tu cuenta"
                : plan === "trial"
                ? "Activa tu plan antes de que expire la prueba"
                : "Elige un plan"}
            </h2>
            {upgradeError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {upgradeError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(["starter", "pro", "empresa"] as const).map((p) => (
                <UpgradeCard
                  key={p}
                  plan={p}
                  onUpgrade={handleUpgrade}
                  upgrading={upgrading}
                />
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">
              Precios en MXN sin IVA · Cancela cuando quieras · Powered by Stripe
            </p>
          </section>
        )}

        {/* Info legal / soporte */}
        <section className="text-sm text-slate-500 space-y-1">
          <p>
            Las facturas y recibos están disponibles en el portal de Stripe (botón "Gestionar suscripción").
          </p>
          <p>
            Para dudas de facturación, escribe a{" "}
            <a
              href="mailto:hjtm81@gmail.com"
              className="text-indigo-600 hover:underline"
            >
              hjtm81@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
