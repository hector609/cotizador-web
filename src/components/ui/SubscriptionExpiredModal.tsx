"use client";

/**
 * SubscriptionExpiredModal — Modal full-screen para suscripción expirada (P1-6).
 *
 * Se monta en el RootLayout. Escucha el evento DOM "subscription:expired"
 * emitido por apiFetch cuando el backend devuelve HTTP 402, y muestra un
 * prompt de renovación que bloquea la UI hasta que el usuario actúe.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SubscriptionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener("subscription:expired", handler);
    return () => window.removeEventListener("subscription:expired", handler);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-expired-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 flex flex-col items-center gap-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-3xl" aria-hidden="true">⏰</span>
        </div>
        <div>
          <h2
            id="sub-expired-title"
            className="text-xl font-bold text-slate-900"
          >
            Tu suscripción expiró
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Para seguir usando el cotizador necesitas renovar tu plan.
            Solo toma un momento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            router.push("/dashboard/billing");
          }}
          className="w-full py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-md"
        >
          Renovar ahora →
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
