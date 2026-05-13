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
 *   - Tabs: Planes (default) / Equipos.
 *   - El componente activo recibe `onCopyToChat(text)` y empuja texto al
 *     composer del chat (NO auto-envía).
 *
 * Responsive:
 *   - Desktop (>= md): renderizado inline en el layout split del chat.
 *   - Mobile (< md): el padre (`CotizarLayout`) lo monta como drawer
 *     colapsable activado por un botón flotante. Este componente NO maneja
 *     visibility — solo renderiza estructura interna.
 */

import { useState } from "react";
import { CatalogoEquiposPanel } from "./CatalogoEquiposPanel";
import { CatalogoPlanesPanel } from "./CatalogoPlanesPanel";

type Tab = "planes" | "equipos";

interface Props {
  onCopyToChat: (text: string) => void;
  /** Opcional: callback para cerrar el panel en mobile (botón ×). */
  onClose?: () => void;
}

export function CatalogoSidebar({ onCopyToChat, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("planes");

  return (
    <aside
      className="flex flex-col h-full min-h-0 bg-white border-l border-slate-200"
      aria-label="Catálogo Telcel"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 leading-tight">
            Catálogo Telcel
          </h2>
          <p className="text-[10px] text-slate-500 leading-tight">
            Solo combos que existen. Copia al chat para evitar typos.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-200 transition text-sm"
            aria-label="Cerrar catálogo"
          >
            ×
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 border-b border-slate-200 bg-white shrink-0">
        <div className="inline-flex bg-slate-100 rounded-md p-0.5 w-full">
          <button
            type="button"
            onClick={() => setTab("planes")}
            className={[
              "flex-1 px-2 py-1 text-xs font-medium rounded transition",
              tab === "planes"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
            aria-pressed={tab === "planes"}
          >
            Planes
          </button>
          <button
            type="button"
            onClick={() => setTab("equipos")}
            className={[
              "flex-1 px-2 py-1 text-xs font-medium rounded transition",
              tab === "equipos"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
            aria-pressed={tab === "equipos"}
          >
            Equipos
          </button>
        </div>
      </div>

      {/* Contenido del tab activo */}
      <div className="flex-1 min-h-0">
        {tab === "planes" ? (
          <CatalogoPlanesPanel onCopyToChat={onCopyToChat} />
        ) : (
          <CatalogoEquiposPanel onCopyToChat={onCopyToChat} />
        )}
      </div>
    </aside>
  );
}
