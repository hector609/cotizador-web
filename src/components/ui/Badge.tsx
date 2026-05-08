/**
 * Badge — small categorical label used for "Más popular", "Próximamente",
 * "Recomendado", etc.
 *
 * Variants are deliberately scarce. In B2B SaaS, badges are noise unless
 * they carry information — three variants force authors to pick a meaning.
 *
 *   primary  — call-attention, our brand blue. Use for "Más popular".
 *   muted    — neutral metadata. Use for "Próximamente", "Beta".
 *   warning  — caution / time-bound. Use sparingly for "Solo este mes".
 */

import type { ReactNode } from "react";

type Variant = "primary" | "muted" | "warning";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-blue-100 text-blue-700",
  muted: "bg-slate-100 text-slate-600",
  warning: "bg-amber-100 text-amber-800",
};

const SIZE: Record<Size, string> = {
  sm: "text-[10px] px-2 py-0.5",
  md: "text-xs px-3 py-1",
};

export type BadgeProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Render as an uppercase pill (default). Disable for sentence-case tags. */
  uppercase?: boolean;
  className?: string;
};

export function Badge({
  children,
  variant = "primary",
  size = "md",
  uppercase = true,
  className = "",
}: BadgeProps) {
  const tracking = uppercase ? "uppercase tracking-wider" : "";
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${VARIANT[variant]} ${SIZE[size]} ${tracking} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
