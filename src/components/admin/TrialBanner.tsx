"use client";

/**
 * TrialBanner — Aviso prominente en dashboard home si user está en trial.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import NumberFlow from "@number-flow/react";

interface BillingStatus {
  subscription_status: string | null;
  trial_ends_at: string | null;
}

export function TrialBanner() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [daysLeft, setDaysLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setStatus(data);
        if (data?.subscription_status === "trialing" && data?.trial_ends_at) {
          const ms = new Date(data.trial_ends_at).getTime() - Date.now();
          const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
          setDaysLeft(days);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !status) return null;

  // Si está en trial
  if (status.subscription_status === "trialing") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-cyan-50 p-4 mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-indigo-900 text-sm sm:text-base">
              Te quedan{" "}
              <span className="text-indigo-600">
                <NumberFlow value={daysLeft} /> {daysLeft === 1 ? "día" : "días"}
              </span>{" "}
              de prueba
            </h3>
            <p className="text-xs sm:text-sm text-indigo-700 mt-1">
              El cobro de $399 MXN/mes comienza el{" "}
              <strong>
                {new Date(status.trial_ends_at!).toLocaleDateString("es-MX", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </strong>
              .
            </p>
          </div>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shrink-0"
          >
            Configurar pago
          </Link>
        </div>
      </motion.div>
    );
  }

  // Si es past_due
  if (status.subscription_status === "past_due") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-4 mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-red-900 text-sm sm:text-base">
              ⚠️ Tu pago está pendiente
            </h3>
            <p className="text-xs sm:text-sm text-red-700 mt-1">
              Regulariza tu forma de pago para no perder acceso. Tienes un período de gracia limitado.
            </p>
          </div>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors shrink-0"
          >
            Actualizar pago
          </Link>
        </div>
      </motion.div>
    );
  }

  return null;
}
