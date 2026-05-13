"use client";

/**
 * Helpers Client Component para la página /dashboard/historial (Server).
 *
 * Aislamos los wrappers de framer-motion aquí para que la página padre siga
 * siendo Server Component (sin `"use client"`) y mantenga SSR sin spinner.
 * Solo los pedacitos interactivos (hover de fila / hover de card / fade-up
 * del empty state) suben al cliente.
 */

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function MotionRow({
  delayIndex,
  children,
}: {
  delayIndex: number;
  children: ReactNode;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        // Stagger discreto: las primeras filas entran antes; cap en 12 para
        // no pasar de ~300ms total ni siquiera con paginación grande.
        delay: Math.min(delayIndex, 12) * 0.02,
      }}
      whileHover={{ backgroundColor: "rgba(79, 70, 229, 0.04)" }}
      className="group"
    >
      {children}
    </motion.tr>
  );
}

export function MotionCard({
  delayIndex,
  children,
}: {
  delayIndex: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay: Math.min(delayIndex, 12) * 0.03,
      }}
      whileHover={{ y: -2, scale: 1.01 }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/40 transition-shadow"
    >
      {children}
    </motion.div>
  );
}

export function MotionEmpty({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
