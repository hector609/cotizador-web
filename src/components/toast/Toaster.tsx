"use client";

/**
 * Toaster — provider visual de notificaciones LUMINA.
 *
 * Mount: una sola vez en `src/app/layout.tsx`, antes de `</body>`.
 * Cualquier componente client puede disparar toasts con:
 *
 *   import { toast } from "@/components/toast/useToast";
 *   toast.success("Cotización lista");
 *
 * Diseño:
 *   - Stack fixed top-right z-50, max 5 toasts.
 *   - Color accent (border-l-4) según tipo: emerald/rose/amber/indigo/cyan.
 *   - Enter slide-in desde la derecha + fade, exit invertido.
 *   - Hover pausa el timer de auto-dismiss (resume al salir).
 *   - Loading no auto-dismiss; cerrar con `toast.dismiss(id)` o promoviéndolo.
 *   - A11Y: error/warning → role=alert + aria-live=assertive; resto polite.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import { toastStore, useToast, type ToastItem, type ToastType } from "./useToast";

/* ───────────────────────── visual config ───────────────────────── */

interface TypeStyle {
  accent: string; // border-l color class
  iconBg: string;
  iconColor: string;
  Icon: React.ComponentType<{ className?: string }>;
  spin?: boolean;
  ariaLive: "polite" | "assertive";
  role: "status" | "alert";
}

const STYLES: Record<ToastType, TypeStyle> = {
  success: {
    accent: "border-l-emerald-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    Icon: CheckCircle2,
    ariaLive: "polite",
    role: "status",
  },
  error: {
    accent: "border-l-rose-500",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    Icon: XCircle,
    ariaLive: "assertive",
    role: "alert",
  },
  warning: {
    accent: "border-l-amber-500",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    Icon: AlertTriangle,
    ariaLive: "assertive",
    role: "alert",
  },
  info: {
    accent: "border-l-indigo-500",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    Icon: Info,
    ariaLive: "polite",
    role: "status",
  },
  loading: {
    accent: "border-l-cyan-500",
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
    Icon: Loader2,
    spin: true,
    ariaLive: "polite",
    role: "status",
  },
};

/* ───────────────────────── single toast item ───────────────────────── */

interface ToastCardProps {
  toast: ToastItem;
}

function ToastCard({ toast: t }: ToastCardProps) {
  const style = STYLES[t.type];
  const Icon = style.Icon;
  const pinned = !Number.isFinite(t.duration);

  // Auto-dismiss con pausa-on-hover. Mantenemos el tiempo restante en un ref
  // para poder reanudar sin reiniciar el contador completo.
  const remainingRef = useRef<number>(t.duration);
  const startRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (pinned) return; // loading: nunca auto-cierra.
    if (paused) return;

    startRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      toastStore.dismiss(t.id);
    }, remainingRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Si el efecto se desmonta por pausa, descontamos el tiempo transcurrido
      // para reanudar después con el restante real.
      if (paused) {
        const elapsed = Date.now() - startRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      }
    };
    // pinned no cambia durante la vida del toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, t.id]);

  const hasTitle = Boolean(t.title && t.title.trim());

  return (
    <motion.div
      layout="position"
      initial={{ x: 360, opacity: 0, scale: 0.96 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 360, opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      whileHover={{ scale: 1.02 }}
      onHoverStart={() => !pinned && setPaused(true)}
      onHoverEnd={() => !pinned && setPaused(false)}
      onFocus={() => !pinned && setPaused(true)}
      onBlur={() => !pinned && setPaused(false)}
      role={style.role}
      aria-live={style.ariaLive}
      aria-atomic="true"
      className={[
        "pointer-events-auto group",
        "flex items-start gap-3",
        "min-w-[320px] max-w-[400px]",
        "rounded-2xl bg-white shadow-xl",
        "border border-slate-200 border-l-4",
        style.accent,
        "px-4 py-3",
      ].join(" ")}
    >
      <span
        className={[
          "shrink-0 inline-flex items-center justify-center",
          "w-8 h-8 rounded-xl",
          style.iconBg,
          style.iconColor,
        ].join(" ")}
        aria-hidden="true"
      >
        <Icon className={`w-4 h-4 ${style.spin ? "animate-spin" : ""}`} />
      </span>

      <div className="flex-1 min-w-0 pt-0.5">
        {hasTitle ? (
          <>
            <p className="text-sm font-semibold text-slate-900 leading-snug">
              {t.title}
            </p>
            <p className="text-sm text-slate-600 leading-snug mt-0.5">
              {t.message}
            </p>
          </>
        ) : (
          <p className="text-sm font-medium text-slate-900 leading-snug">
            {t.message}
          </p>
        )}

        {t.action && (
          <button
            type="button"
            onClick={() => {
              try {
                t.action?.onClick();
              } finally {
                toastStore.dismiss(t.id);
              }
            }}
            className={[
              "mt-2 inline-flex items-center",
              "rounded-full px-3 py-1",
              "text-xs font-semibold",
              "text-cyan-700 bg-white",
              "border border-cyan-200",
              "hover:bg-cyan-50 hover:border-cyan-300",
              "transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1",
            ].join(" ")}
          >
            {t.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => toastStore.dismiss(t.id)}
        aria-label="Cerrar notificación"
        className={[
          "shrink-0 -mr-1 -mt-1",
          "inline-flex items-center justify-center",
          "w-6 h-6 rounded-lg",
          "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
          "transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-indigo-400",
        ].join(" ")}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

/* ───────────────────────── provider ───────────────────────── */

/**
 * `<Toaster />` — montar UNA sola vez en el root layout.
 * No acepta props; toda la config se hace por toast via `toast.success(...)`.
 */
export function Toaster() {
  const toasts = useToast();

  return (
    <div
      // pointer-events-none en el contenedor → no bloqueamos clicks fuera de
      // las cards. Cada card re-habilita pointer-events.
      aria-label="Notificaciones"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default Toaster;
