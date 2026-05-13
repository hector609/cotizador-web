"use client";

/**
 * CatalogoSidebar — panel lateral con catálogo Telcel REAL, pensado para vivir
 * junto al chat conversacional en /dashboard/cotizar.
 *
 * Problema que resuelve: el chat aceptaba combos imposibles (e.g. PORTABILIDAD
 * + EMPRESA 9 + 24m + ARRENDAMIENTO) porque el vendedor escribía a ciegas. Al
 * exponer planes/equipos reales con filtros encadenados, el vendedor ve qué
 * existe y copia el nombre exacto al composer.
 *
 * Estructura:
 *   - Header: título + subtitle "Combos reales para evitar imposibles"
 *   - Tabs segmented pill (Equipos / Planes) con indicador animado via
 *     `motion.span layoutId="catalog-tab-pill"`.
 *   - El componente activo recibe `onCopyToChat(text)` y empuja texto al
 *     composer del chat (NO auto-envía).
 *
 * Responsive:
 *   - Desktop (>= md): renderizado inline en el layout split del chat.
 *   - Mobile (< md): el padre (`CotizarLayout`) lo monta como drawer
 *     colapsable activado por un botón flotante. Este componente NO maneja
 *     visibility — solo renderiza estructura interna.
 *
 * LUMINA Light: surfaces bg-white, indigo `#4F46E5` primary + cyan `#06B6D4`
 * accent, pill buttons rounded-full, hairline borders slate-200.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { CatalogoEquiposPanel } from "./CatalogoEquiposPanel";
import { CatalogoPlanesPanel } from "./CatalogoPlanesPanel";

type Tab = "equipos" | "planes";

interface Props {
  onCopyToChat: (text: string) => void;
  /** Opcional: callback para cerrar el panel en mobile (botón ×). */
  onClose?: () => void;
}

export function CatalogoSidebar({ onCopyToChat, onClose }: Props) {
  // El brief pide tabs "Equipos | Planes" — equipos primero porque es el
  // ancla más común del wizard (vendedor parte del modelo).
  const [tab, setTab] = useState<Tab>("equipos");

  return (
    <aside
      className="flex flex-col h-full min-h-0 bg-white border-l border-slate-200"
      aria-label="Catálogo Telcel"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white shrink-0 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            Catálogo Telcel
          </h2>
          <p className="text-xs text-slate-500 leading-tight mt-0.5">
            Combos reales para evitar imposibles
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-slate-900 p-1.5 rounded-full hover:bg-slate-100 transition"
            aria-label="Cerrar catálogo"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs segmented pill con indicador animado */}
      <div className="px-4 py-3 bg-white shrink-0">
        <div
          className="relative inline-flex w-full bg-slate-100 rounded-full p-1"
          role="tablist"
          aria-label="Tipo de catálogo"
        >
          {(["equipos", "planes"] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-pressed={active}
                aria-selected={active}
                onClick={() => setTab(t)}
                className="relative flex-1 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors z-10"
              >
                {active && (
                  <motion.span
                    layoutId="catalog-tab-pill"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={
                    active
                      ? "relative text-white"
                      : "relative text-slate-600 hover:text-slate-900"
                  }
                >
                  {t === "equipos" ? "Equipos" : "Planes"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del tab activo */}
      <div className="flex-1 min-h-0">
        {tab === "equipos" ? (
          <CatalogoEquiposPanel onCopyToChat={onCopyToChat} />
        ) : (
          <CatalogoPlanesPanel onCopyToChat={onCopyToChat} />
        )}
      </div>
    </aside>
  );
}
