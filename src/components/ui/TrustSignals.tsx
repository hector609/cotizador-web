/**
 * TrustSignals — horizontal row of icon+label pairs used below hero CTAs
 * to reinforce data residency, security, and contract terms.
 *
 * Today the landing and /precios both inline three nearly-identical rows
 * with green dots. This primitive replaces the green dots with proper
 * semantic icons, preserves the centered wrap layout, and keeps the
 * understated typographic weight (text-xs, slate-600) — trust signals
 * should whisper, not shout.
 */

import type { ComponentType, SVGProps } from "react";

type IconComponent = ComponentType<{ className?: string } & SVGProps<SVGSVGElement>>;

export type TrustSignal = {
  /** Icon component (e.g. `MapPinIcon`) from `@/components/icons`. */
  icon: IconComponent;
  /** Short label, ~3 words. Longer labels break the row. */
  label: string;
};

export type TrustSignalsProps = {
  items: TrustSignal[];
  /** Center horizontally (default) or align left under a CTA. */
  align?: "center" | "start";
  className?: string;
};

export function TrustSignals({
  items,
  align = "center",
  className = "",
}: TrustSignalsProps) {
  const justify = align === "center" ? "justify-center" : "justify-start";
  return (
    <ul
      className={`flex flex-wrap items-center ${justify} gap-x-5 gap-y-2 text-xs text-slate-600 ${className}`.trim()}
    >
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-blue-700" aria-hidden />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
