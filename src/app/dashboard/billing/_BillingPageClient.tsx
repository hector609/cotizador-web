"use client";

/**
 * /dashboard/billing — Gestión de suscripción del tenant.
 *
 * LUMINA Light Premium: indigo #4F46E5, cyan #06B6D4, pink #EC4899,
 * white/slate-50, Geist. Cards rounded-2xl border-slate-200 shadow-sm.
 * framer-motion fade-up al cargar. NumberFlow para días restantes.
 *
 * Secciones:
 *  1. "Mi suscripción" — card grande con estado actual (activo/trial/cancelado).
 *     - Si active | trialing: plan, próxima renovación, botones Administrar/Cancelar.
 *     - Si trialing: barra de progreso "Te quedan X días de prueba" + CTA.
 *     - Si canceled | expired: aviso de reactivación.
 *  2. Cards de planes para upgrade/reactivación (cuando aplica).
 *  3. Pie de página con info legal.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { QuickPayButton } from "@/components/billing/QuickPayButton";
import { Badge } from "@/components/ui/Badge";

/* ---------- Tipos ---------- */

interface BillingStatus {
  subscription_plan: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

/* ---------- Constantes ---------- */

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  empresa: "Empresa",
  vendedor_telcel: "Vendedor Telcel",
  trial: "Prueba gratuita",
  expired: "Expirado",
};

const PLAN_PRICES: Record<string, number> = {
  starter: 999,
  pro: 2499,
  empresa: 4999,
};

const PLAN_DESCRIPTIONS: Record<string, string[]> = {
  starter: ["Hasta 3 vendedores", "Cotizaciones ilimitadas", "Bot Telegram", "Soporte e-mail"],
  pro: ["Hasta 10 vendedores", "Historial completo", "Optimizador IA", "Soporte prioritario"],
  empresa: ["Vendedores ilimitados", "White-label", "API acceso", "Soporte dedicado"],
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: "Activa", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  trialing: { label: "Período de prueba", cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  past_due: { label: "Pago pendiente", cls: "text-amber-700 bg-amber-50 border-amber-200" },
  canceled: { label: "Cancelada", cls: "text-slate-600 bg-slate-50 border-slate-200" },
  expired: { label: "Expirada", cls: "text-red-600 bg-red-50 border-red-200" },
};

/* ---------- Animaciones ---------- */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/* ---------- Helpers ---------- */

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

function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/* ---------- Hook ---------- */

function useBillingStatus() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<BillingStatus>;
      })
      .then(setStatus)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { status, loading, error };
}

/* ---------- Sub-componentes ---------- */

function StatusBadge({ statusKey }: { statusKey: string | null }) {
  const cfg = STATUS_BADGE[statusKey ?? ""] ?? {
    label: statusKey ?? "—",
    cls: "text-slate-600 bg-slate-50 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function TrialProgressBar({ trialEnd }: { trialEnd: string | null }) {
  const totalDays = 14; // ajustar si el trial es diferente
  const daysLeft = daysUntil(trialEnd);
  const pct = Math.round(((totalDays - Math.min(daysLeft, totalDays)) / totalDays) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 font-medium">Días de prueba restantes</span>
        <span className="font-bold text-indigo-700">
          <NumberFlow value={daysLeft} /> {daysLeft === 1 ? "día" : "días"}
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- Sección "Mi suscripción" ---------- */

function CurrentSubscriptionCard({
  status,
  onPortal,
  onCancel,
  portalLoading,
  cancelLoading,
  portalError,
  isAdmin,
}: {
  status: BillingStatus;
  onPortal: () => void;
  onCancel: () => void;
  portalLoading: boolean;
  cancelLoading: boolean;
  portalError: string | null;
  isAdmin: boolean;
}) {
  const sub = status.subscription_status;
  const plan = status.subscription_plan;
  const isActive = sub === "active" || sub === "trialing";
  const isInactive = sub === "canceled" || sub === "expired";
  const isTrialing = sub === "trialing";
  const hasStripe = !!status.stripe_customer_id;

  const planLabel = PLAN_LABELS[plan ?? ""] ?? plan ?? "—";

  if (isInactive) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-semibold text-red-800 text-base">Tu suscripción está vencida</p>
          <p className="text-sm text-red-600 mt-0.5">
            Escoge un plan abajo para reactivar tu cuenta y volver a cotizar.
          </p>
        </div>
        <Link
          href="#planes"
          className="shrink-0 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
        >
          Ver planes
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Encabezado de la card */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Plan actual</p>
          <h2 className="text-2xl font-extrabold text-slate-900">{planLabel}</h2>
        </div>
        <StatusBadge statusKey={sub} />
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Trial progress bar */}
        {isTrialing && (
          <TrialProgressBar trialEnd={status.trial_ends_at ?? status.current_period_end} />
        )}

        {/* Detalles de renovación */}
        {isActive && status.current_period_end && (
          <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-4">
            <span className="text-slate-500">
              {isTrialing ? "Prueba vence el" : "Próxima renovación"}
            </span>
            <span className="font-semibold text-slate-800">{formatDate(status.current_period_end)}</span>
          </div>
        )}

        {/* Aviso past_due */}
        {sub === "past_due" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Hay un pago pendiente. Actualiza tu tarjeta en "Administrar pagos" para evitar la cancelación.
          </div>
        )}

        {/* Error portal */}
        {portalError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {portalError}
          </div>
        )}

        {/* CTA trial */}
        {isTrialing && (
          <div className="pt-1">
            <p className="text-sm text-slate-500 mb-3">
              Suscríbete ahora para no perder acceso cuando termine la prueba.
            </p>
            <Link
              href="#planes"
              className="inline-flex px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold shadow-md hover:opacity-90 transition-opacity"
            >
              Suscríbete ahora
            </Link>
          </div>
        )}
      </div>

      {/* Botones de acción (solo admins) */}
      {hasStripe && isAdmin && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={portalLoading || cancelLoading}
            onClick={onPortal}
            className="px-5 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {portalLoading ? "Cargando..." : "Administrar pagos"}
          </button>
          <button
            type="button"
            disabled={portalLoading || cancelLoading}
            onClick={onCancel}
            className="px-5 py-2.5 rounded-full border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {cancelLoading ? "Cargando..." : "Cancelar suscripción"}
          </button>
        </div>
      )}
      {/* Vendedores ven aviso read-only */}
      {!isAdmin && hasStripe && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          Contacta al administrador para cambiar el plan o la forma de pago.
        </div>
      )}
    </div>
  );
}

/* ---------- Card de plan (upgrade) ---------- */

function UpgradeCard({
  plan,
  onUpgrade,
  upgrading,
}: {
  plan: string;
  onUpgrade: (plan: string) => void;
  upgrading: string | null;
}) {
  const price = PLAN_PRICES[plan] ?? 0;
  const label = PLAN_LABELS[plan] ?? plan;
  const features = PLAN_DESCRIPTIONS[plan] ?? [];
  const isFeatured = plan === "pro";
  const isLoading = upgrading === plan;

  return (
    <div
      className={[
        "relative rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-200",
        isFeatured
          ? "border-indigo-400 shadow-lg shadow-indigo-100/50 bg-white"
          : "border-slate-200 bg-white hover:border-indigo-200",
      ].join(" ")}
    >
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="primary" size="sm">
            Más popular
          </Badge>
        </div>
      )}
      <div>
        <p className="font-bold text-slate-900 text-base">{label}</p>
        <div className="flex items-end gap-1 mt-2">
          <span className="text-3xl font-extrabold text-slate-900">
            $<NumberFlow value={price} format={{ maximumFractionDigits: 0 }} locales="es-MX" />
          </span>
          <span className="text-sm text-slate-500 mb-1">MXN/mes</span>
        </div>
      </div>

      <ul className="space-y-1.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
            <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 16 16">
              <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

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

/* ---------- Skeleton de carga ---------- */

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

/* ---------- Página principal ---------- */

interface BillingPageClientProps {
  isAdmin?: boolean;
}

export default function BillingPageClient({ isAdmin = false }: BillingPageClientProps) {
  const { status, loading, error } = useBillingStatus();

  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  /* Parámetros de URL para feedback post-checkout */
  const [checkoutParam, setCheckoutParam] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCheckoutParam(new URLSearchParams(window.location.search).get("checkout"));
    }
  }, []);

  /* Acción: ir al Customer Portal */
  const handlePortal = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const resp = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await resp.json()) as { url?: string; error?: string };
      if (!resp.ok || !data.url) {
        setPortalError(data.error ?? "No se pudo abrir el portal de pagos. Intenta de nuevo.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setPortalError("Error de red. Intenta de nuevo.");
    } finally {
      setPortalLoading(false);
    }
  };

  /* Acción: cancelar suscripción — mismo portal, Stripe tiene la opción de cancel */
  const handleCancel = async () => {
    setCancelLoading(true);
    setPortalError(null);
    try {
      const resp = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await resp.json()) as { url?: string; error?: string };
      if (!resp.ok || !data.url) {
        setPortalError(data.error ?? "No se pudo abrir el portal de cancelación. Intenta de nuevo.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setPortalError("Error de red. Intenta de nuevo.");
    } finally {
      setCancelLoading(false);
    }
  };

  /* Acción: upgrade de plan */
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
    } catch {
      setUpgradeError("Error de red. Intenta de nuevo.");
    } finally {
      setUpgrading(null);
    }
  };

  const sub = status?.subscription_status ?? null;
  const plan = status?.subscription_plan ?? null;
  const isActive = sub === "active" || sub === "trialing";
  const showUpgrade = !isActive || plan === "trial" || plan === "expired";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Suscripcion</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gestiona tu plan y facturacion</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Muestra CTA de pago cuando el estado lo requiere (trialing/past_due/etc.) */}
            <QuickPayButton inline />
            <Link
              href="/dashboard"
              className="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Feedback post-checkout */}
        {checkoutParam === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-5 py-4 text-sm font-medium"
          >
            Pago exitoso. Tu suscripcion esta activa. Puede tardar unos segundos en reflejarse.
          </motion.div>
        )}
        {checkoutParam === "canceled" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm"
          >
            El pago fue cancelado. Tu plan actual sigue vigente.
          </motion.div>
        )}

        {/* Estado principal */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
            No se pudo cargar la informacion de suscripcion ({error}). Recarga la pagina.
          </div>
        ) : (
          <>
            {/* Seccion: Mi suscripcion */}
            <motion.section
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="show"
            >
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Mi suscripcion
              </h2>
              <CurrentSubscriptionCard
                status={status!}
                onPortal={handlePortal}
                onCancel={handleCancel}
                portalLoading={portalLoading}
                cancelLoading={cancelLoading}
                portalError={portalError}
                isAdmin={isAdmin}
              />
            </motion.section>

            {/* Seccion: Upgrade / planes */}
            {showUpgrade && (
              <motion.section
                id="planes"
                custom={1}
                variants={fadeUp}
                initial="hidden"
                animate="show"
              >
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-3">
                  {sub === "canceled" || sub === "expired" || plan === "expired"
                    ? "Elige un plan para reactivar"
                    : sub === "trialing"
                    ? "Activa tu plan antes de que venza la prueba"
                    : "Elige un plan"}
                </h2>
                {upgradeError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    {upgradeError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(["starter", "pro", "empresa"] as const).map((p, i) => (
                    <motion.div
                      key={p}
                      custom={i + 2}
                      variants={fadeUp}
                      initial="hidden"
                      animate="show"
                    >
                      <UpgradeCard
                        plan={p}
                        onUpgrade={handleUpgrade}
                        upgrading={upgrading}
                      />
                    </motion.div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-4 text-center">
                  Precios en MXN sin IVA · Cancela cuando quieras · Powered by Stripe
                </p>
              </motion.section>
            )}
          </>
        )}

        {/* Pie de pagina / soporte */}
        <motion.section
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-sm text-slate-500 space-y-1 border-t border-slate-200 pt-6"
        >
          <p>
            Las facturas y recibos estan disponibles en el portal de Stripe (boton "Administrar pagos").
          </p>
          <p>
            Para dudas de facturacion, escribe a{" "}
            <a href="mailto:hjtm81@gmail.com" className="text-indigo-600 hover:underline">
              hjtm81@gmail.com
            </a>
            .
          </p>
        </motion.section>
      </div>
    </div>
  );
}
