// public-api — use for marketing page sections to standardize max-w-6xl mx-auto px-6 py-16 rhythm.
// Prefer this over hand-rolling spacing per-page.

/**
 * Section — page section wrapper that standardizes vertical rhythm and
 * horizontal max-width across the marketing pages.
 *
 * Why: today every page hand-rolls `max-w-6xl mx-auto px-6 py-16/20` which
 * drifts (some `py-12`, some `py-20`). One primitive keeps the rhythm
 * consistent and lets us tune the scale globally.
 *
 * Background variants are intentionally limited: white (default), slate
 * (secondary), gradient (hero only), and dark (CTA strip). No "primary"
 * solid blue background — that gets reserved for the dark CTA which uses
 * gradient.
 */

import type { ReactNode } from "react";

type Background = "white" | "slate" | "gradient" | "dark";
type Spacing = "sm" | "md" | "lg";

const BG: Record<Background, string> = {
  white: "bg-white",
  slate: "bg-slate-50",
  gradient: "bg-gradient-to-br from-slate-50 to-blue-50",
  dark: "bg-gradient-to-br from-blue-700 to-blue-900 text-white",
};

const SPACING: Record<Spacing, string> = {
  // Aligned with an 8pt scale. Mobile keeps breathing room without dwarfing
  // small screens; md+ gets the full marketing page rhythm.
  sm: "py-12 md:py-16",
  md: "py-16 md:py-20",
  lg: "py-20 md:py-28",
};

export type SectionProps = {
  children: ReactNode;
  /** Background style. Defaults to `white`. */
  bg?: Background;
  /** Vertical spacing scale. Defaults to `md`. */
  spacing?: Spacing;
  /** Extra classes appended to the outer wrapper (rarely needed). */
  className?: string;
  /** Inner max-width — defaults to 6xl. Use `narrow` for FAQ/legal copy. */
  width?: "narrow" | "default" | "wide";
  /** Render an `<section>` (default) or any landmark element. */
  as?: "section" | "header" | "footer" | "div";
  /** Optional id for in-page anchors. */
  id?: string;
};

const WIDTH: Record<NonNullable<SectionProps["width"]>, string> = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

export function Section({
  children,
  bg = "white",
  spacing = "md",
  width = "default",
  className = "",
  as: Tag = "section",
  id,
}: SectionProps) {
  return (
    <Tag id={id} className={`${BG[bg]} ${className}`.trim()}>
      <div className={`${WIDTH[width]} mx-auto px-6 ${SPACING[spacing]}`}>
        {children}
      </div>
    </Tag>
  );
}
