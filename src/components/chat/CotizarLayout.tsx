"use client";

/**
 * CotizarLayout — composición client-side de la página /dashboard/cotizar.
 *
 * Razón de existir: el Server Component padre (`cotizar/page.tsx`) verifica
 * la sesión y renderiza la nav. La interacción real entre el chat y el
 * panel de catálogo es client-only y bidireccional (el panel empuja texto
 * al composer del chat), así que la concentramos aquí.
 *
 * Layout split (>= md):
 *   ┌───────────────────────────┬─────────────┐
 *   │       ChatInterface       │ Catálogo    │
 *   │       (flex: 1)           │ (380px)     │
 *   └───────────────────────────┴─────────────┘
 *
 * Mobile (< md):
 *   - ChatInterface ocupa todo el viewport.
 *   - Botón flotante "📋 Catálogo" abajo-derecha abre un drawer que cubre
 *     el viewport con el panel. Al cerrar regresa el chat.
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
    <div className="flex-1 min-h-0 flex flex-col md:flex-row">
      {/* Chat (siempre presente) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatInterface onReady={handleChatReady} />
      </div>

      {/* Catálogo: desktop inline (md+), mobile drawer */}
      <div className="hidden md:flex md:flex-col md:w-[360px] lg:w-[400px] md:shrink-0 md:min-h-0">
        <CatalogoSidebar onCopyToChat={handleCopyToChat} />
      </div>

      {/* Mobile FAB para abrir catálogo */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-30 bg-blue-700 text-white text-xs font-semibold rounded-full shadow-lg px-4 py-2.5 hover:bg-blue-800 transition flex items-center gap-1.5"
        aria-label="Abrir catálogo Telcel"
      >
        <span aria-hidden="true">📋</span>
        Catálogo
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 flex flex-col bg-white"
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
