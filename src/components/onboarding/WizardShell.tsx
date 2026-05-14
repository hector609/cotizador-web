"use client";

/**
 * WizardShell — layout del onboarding wizard LUMINA Light Premium.
 *
 * Incluye:
 *  - Header con logo + nombre del paso
 *  - Barra de progreso con 7 dots (completado=indigo, activo=ring, pendiente=slate)
 *  - Área de contenido (children)
 *  - Footer con botones Atrás / Siguiente (o Saltar para pasos opcionales)
 *
 * Mobile-first: en móvil el layout es una columna. En desktop, card centrada
 * max-w-2xl con padding generoso.
 */

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";

export const STEP_LABELS: Record<number, string> = {
  1: "Datos del distribuidor",
  2: "Contacto",
  3: "Branding",
  4: "Credenciales Telcel",
  5: "Cartera inicial",
  6: "Equipo de vendedores",
  7: "Confirmación",
};

const TOTAL_STEPS = 7;
const OPTIONAL_STEPS = [5, 6];

interface WizardShellProps {
  step: number;
  /** Pasos completados hasta ahora (incluyendo ediciones pasadas). */
  maxReached: number;
  children: React.ReactNode;
  /** Handler del botón Siguiente / Completar. */
  onNext: () => void | Promise<void>;
  /** Handler del botón Atrás. Null si es paso 1. */
  onBack: (() => void) | null;
  /** Handler de Saltar (solo en pasos opcionales). */
  onSkip?: () => void | Promise<void>;
  /** Texto del botón principal (default "Siguiente"). */
  nextLabel?: string;
  /** Deshabilitar el botón Siguiente mientras valida/carga. */
  nextDisabled?: boolean;
  /** Mostrar spinner en botón Siguiente. */
  nextLoading?: boolean;
}

export function WizardShell({
  step,
  maxReached,
  children,
  onNext,
  onBack,
  onSkip,
  nextLabel,
  nextDisabled = false,
  nextLoading = false,
}: WizardShellProps) {
  const isOptional = OPTIONAL_STEPS.includes(step);
  const isLast = step === TOTAL_STEPS;
  const label = nextLabel ?? (isLast ? "Empezar" : "Siguiente");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <span className="font-extrabold tracking-tight text-slate-900 text-lg">
            Cotizador
          </span>
          <span className="text-sm text-slate-500 font-medium truncate">
            Paso {step} de {TOTAL_STEPS} — {STEP_LABELS[step]}
          </span>
        </div>
      </header>

      {/* Progress dots */}
      <div className="bg-white border-b border-slate-100 py-4">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <ProgressDots current={step} maxReached={maxReached} total={TOTAL_STEPS} />
        </div>
      </div>

      {/* Content area */}
      <main className="flex-1 flex flex-col items-center justify-start py-8 px-4 sm:px-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Step heading */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
                {STEP_LABELS[step]}
              </h1>
              {isOptional && (
                <p className="text-sm text-slate-500 mb-6">
                  Este paso es opcional. Puedes completarlo ahora o después desde el panel.
                </p>
              )}
              {!isOptional && <div className="mb-6" />}

              {/* Children (step form) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-100/60 p-6 sm:p-8">
                {children}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer nav */}
      <footer className="bg-white border-t border-slate-200 sticky bottom-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Back */}
          <div className="flex-1">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-full px-3 py-2 hover:bg-slate-100 transition"
                aria-label="Paso anterior"
              >
                <ChevronLeft className="w-4 h-4" />
                Atrás
              </button>
            ) : (
              <div />
            )}
          </div>

          {/* Skip (optional steps) */}
          {isOptional && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 px-3 py-2 rounded-full hover:bg-slate-100 transition"
            >
              Saltar este paso
            </button>
          )}

          {/* Next / Complete */}
          <motion.button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || nextLoading}
            whileHover={nextDisabled || nextLoading ? {} : { scale: 1.02 }}
            whileTap={nextDisabled || nextLoading ? {} : { scale: 0.98 }}
            className={[
              "inline-flex items-center gap-2",
              "rounded-full px-6 py-2.5",
              "text-sm font-bold text-white",
              "transition-all duration-150",
              isLast
                ? "bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-200 hover:shadow-indigo-300"
                : "bg-indigo-600 hover:bg-indigo-700",
              (nextDisabled || nextLoading) ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
            aria-label={label}
          >
            {nextLoading && (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
            )}
            {label}
          </motion.button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────── Progress dots ─────────── */

function ProgressDots({
  current,
  maxReached,
  total,
}: {
  current: number;
  maxReached: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total} aria-label={`Paso ${current} de ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < current || (stepNum < maxReached && stepNum !== current);
        const isCurrent = stepNum === current;
        const isReachable = stepNum <= maxReached;

        return (
          <div key={stepNum} className="flex items-center gap-2">
            <motion.div
              layout
              className={[
                "rounded-full transition-all duration-300 flex items-center justify-center",
                isCurrent
                  ? "w-8 h-8 ring-2 ring-indigo-500 ring-offset-2 bg-indigo-600 text-white text-xs font-bold"
                  : isCompleted
                  ? "w-6 h-6 bg-indigo-600"
                  : isReachable
                  ? "w-6 h-6 bg-slate-200"
                  : "w-5 h-5 bg-slate-100",
              ].join(" ")}
              aria-label={
                isCurrent
                  ? `Paso actual: ${STEP_LABELS[stepNum]}`
                  : isCompleted
                  ? `Completado: ${STEP_LABELS[stepNum]}`
                  : `Pendiente: ${STEP_LABELS[stepNum]}`
              }
            >
              {isCurrent && <span>{stepNum}</span>}
              {isCompleted && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </motion.div>
            {stepNum < total && (
              <div
                className={[
                  "h-0.5 flex-1 min-w-[12px] max-w-[32px] rounded-full transition-colors duration-300",
                  stepNum < current ? "bg-indigo-400" : "bg-slate-200",
                ].join(" ")}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
