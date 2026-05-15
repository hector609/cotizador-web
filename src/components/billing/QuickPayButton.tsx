"use client";

/**
 * QuickPayButton — Botón flotante/inline para pagar suscripción.
 *
 * Visible si subscription_status en ["trialing", "past_due", "canceled", "expired"]
 *
 * Props:
 *   - inline: boolean (default: false) — si true, renderiza inline (para desktop)
 *     si false, flotante sticky bottom-right (para mobile/siempre visible)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

interface BillingStatus {
  subscription_status: string | null;
  trial_ends_at: string | null;
}

interface QuickPayButtonProps {
  inline?: boolean;
}

export function QuickPayButton({ inline = false }: QuickPayButtonProps) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setStatus(data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !status || !status.subscription_status) return null;

  const needsPayment = ["trialing", "past_due", "canceled", "expired"].includes(
    status.subscription_status
  );

  if (!needsPayment) return null;

  const isTrialing = status.subscription_status === "trialing";
  const buttonText = isTrialing ? "Suscribirme — $399/mes" : "Reactivar suscripción";
  const buttonLabel = isTrialing ? "Iniciar suscripción" : "Reactivar suscripción";

  // Contenedor flotante o inline
  const containerClass = inline
    ? "inline-flex"
    : "fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50";

  const buttonClass = `
    inline-flex items-center gap-2 px-5 py-3 rounded-full
    font-semibold text-sm transition-all duration-200
    ${
      isTrialing
        ? "bg-gradient-to-r from-indigo-600 to-pink-500 hover:from-indigo-700 hover:to-pink-600 text-white shadow-lg hover:shadow-indigo-300"
        : "bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 text-white shadow-lg hover:shadow-red-300"
    }
    hover:scale-105 active:scale-95
  `;

  // Si es inline, retorna el botón sin envoltura flotante
  if (inline) {
    return (
      <Link href="/dashboard/billing" className={buttonClass}>
        {buttonText}
      </Link>
    );
  }

  // Si es flotante, usa motion para entrada suave
  return (
    <motion.div
      className={containerClass}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Link href="/dashboard/billing" className={buttonClass} title={buttonLabel}>
        {buttonText}
      </Link>
    </motion.div>
  );
}
