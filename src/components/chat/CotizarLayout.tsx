"use client";

/**
 * CotizarLayout — composición client-side de la página /dashboard/cotizar.
 *
 * REDISEÑO "REVENTAR mode": dark glassmorphism premium. El padre Server
 * Component renderiza Sidebar fijo izquierdo dark + este componente para el
 * resto del viewport. Aquí montamos el chat al centro (con mesh radial top-
 * right de fondo) y el catálogo Telcel a la derecha en `lg+`.
 *
 * Layout split (>= lg):
 *   ┌─────────────────────────────────┬─────────────┐
 *   │     ChatInterface (center)      │  Catálogo   │
 *   │     mesh gradient + glow        │  (w-96)     │
 *   └─────────────────────────────────┴─────────────┘
 *
 * Mobile/tablet (< lg):
 *   - ChatInterface ocupa todo el viewport.
 *   - Botón flotante "Catálogo" abajo-derecha abre un drawer que cubre
 *     el viewport con el panel.
 *
 * Bridge chat↔catálogo:
 *   - `ChatInterface` expone una API `{append}` vía prop `onReady`.
 *   - Guardamos esa API en un ref del layout.
 *   - El panel de catálogo recibe un callback `onCopyToChat` que llama
 *     `api.append(text)`. Si el chat aún no publicó la API (race), el
 *     callback es no-op (defensivo).
 */

import { useCallback, useRef, useState } from "react";
import {
  ChatInterface,
  type ChatInterfaceApi,
} from "./ChatInterface";
import { CatalogoSidebar } from "@/components/catalogo/CatalogoSidebar";

export function CotizarLayout() {
  const chatApiRef = useRef<ChatInterfaceApi | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleChatReady = useCallback((api: ChatInterfaceApi) => {
    chatApiRef.current = api;
  }, []);

  const handleCopyToChat = useCallback((text: string) => {
    chatApiRef.current?.append(text);
    // En mobile cerramos el drawer tras copiar para que el vendedor vea
    // el texto en el composer y pueda editarlo/enviarlo.
    setMobileOpen(false);
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row relative">
      {/* Mesh radial top-right (blue/cyan) + faint grid hairline. Capa fija
          detrás del contenido — pointer-events:none para no interferir.
          Vive aquí (no en el chat) para que el patrón se extienda también
          debajo del catálogo y mantenga la continuidad visual del shell. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 85% 15%, rgba(29, 78, 216, 0.18) 0%, transparent 45%), radial-gradient(circle at 95% 5%, rgba(76, 215, 246, 0.12) 0%, transparent 35%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Chat (siempre presente) */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
        <ChatInterface onReady={handleChatReady} />
      </div>

      {/* Catálogo: desktop inline (lg+, audit B6 — antes md+ ahogaba el chat
          en tablet), mobile/tablet drawer flotante. El wrapper aplica el
          shell dark del REVENTAR mode; el componente interno mantiene su
          propia estructura (tabs + listas) que ya fue diseñada compacta. */}
      <div className="relative z-10 hidden lg:flex lg:flex-col lg:w-96 xl:w-[400px] lg:shrink-0 lg:min-h-0 lg:border-l lg:border-white/10 lg:bg-[#060e20]">
        <CatalogoSidebar onCopyToChat={handleCopyToChat} />
      </div>

      {/* FAB para abrir catálogo (mobile + tablet) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-24 right-4 z-30 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-br from-blue-600 to-cyan-500 border border-white/15 shadow-[0_0_24px_rgba(29,78,216,0.45)] hover:scale-105 transition"
        aria-label="Abrir catálogo Telcel"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4.5A2.5 2.5 0 016.5 2H20v15H6.5a2.5 2.5 0 010-5H20" />
        </svg>
        Catálogo
      </button>

      {/* Drawer mobile/tablet */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex flex-col bg-[#060e20]"
          role="dialog"
          aria-modal="true"
          aria-label="Catálogo Telcel"
        >
          <CatalogoSidebar
            onCopyToChat={handleCopyToChat}
            onClose={() => setMobileOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
