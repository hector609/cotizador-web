"use client";

/**
 * DashboardActionTiles — 4 action tiles bajo los KPIs.
 *
 * - "Nueva cotización" primary con gradient indigo→cyan.
 * - "Subir Excel", "Mis clientes", "Catálogo" white con hover indigo soft.
 * - framer-motion whileHover scale 1.02 + shadow.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { Send, Upload, Users, Package, type LucideIcon } from "lucide-react";

interface Tile {
  href: string;
  title: string;
  Icon: LucideIcon;
  variant?: "primary" | "default";
}

const TILES: Tile[] = [
  {
    href: "/dashboard/cotizar",
    title: "Nueva cotización",
    Icon: Send,
    variant: "primary",
  },
  {
    href: "/dashboard/cotizar-excel",
    title: "Subir Excel",
    Icon: Upload,
  },
  {
    href: "/dashboard/clientes",
    title: "Mis clientes",
    Icon: Users,
  },
  {
    href: "/dashboard/catalogos",
    title: "Catálogo",
    Icon: Package,
  },
];

export function DashboardActionTiles() {
  return (
    <section
      aria-labelledby="acciones-heading"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <h2 id="acciones-heading" className="sr-only">
        Acciones rápidas
      </h2>
      {TILES.map((t) => (
        <ActionTile key={t.href} tile={t} />
      ))}
    </section>
  );
}

function ActionTile({ tile }: { tile: Tile }) {
  const isPrimary = tile.variant === "primary";
  const Icon = tile.Icon;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
    >
      <Link
        href={tile.href}
        aria-label={tile.title}
        className={[
          "block rounded-2xl p-6 transition-shadow",
          isPrimary
            ? "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-200/60 hover:shadow-xl hover:shadow-indigo-300/60"
            : "bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 text-slate-900 shadow-sm hover:shadow-md",
        ].join(" ")}
      >
        <Icon
          className={[
            "w-12 h-12 mb-3",
            isPrimary ? "text-white" : "text-indigo-600",
          ].join(" ")}
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <p
          className={[
            "text-base font-bold",
            isPrimary ? "text-white" : "text-slate-900",
          ].join(" ")}
        >
          {tile.title}
        </p>
      </Link>
    </motion.div>
  );
}
