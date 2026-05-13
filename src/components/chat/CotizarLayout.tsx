"use client";

/**
 * CotizarLayout — composición client-side de la página /dashboard/cotizar.
 *
 * REDISEÑO LUMINA Light Premium (pivot 2026-05-13). Shell light tipo Linear
 * cuando rediseñaron a fondo: `bg-slate-50` global, surfaces `bg-white`,
 * paleta indigo-600 (#4F46E5) + cyan-500 (#06B6D4) + pink-500 (#EC4899).
 * Cero glassmorphism dark, cero `#0b1326`.
 *
 * Layout 3 paneles (desktop lg+):
 *   ┌──────────┬────────────────────────────┬─────────────┐
 *   │ Sidebar  │     ChatInterface          │  Catálogo   │
 *   │ (left)   │     bg-slate-50            │  bg-white   │
 *   │ owned by │     mid pane               │  (w-96)     │
 *   │ parent   │                            │             │
 *   └──────────┴────────────────────────────┴─────────────┘
 *
 * Este componente solo monta `[chat | catálogo]`. El Sidebar lo monta el
 * padre Server Component (`page.tsx`) para que TODO el dashboard comparta
 * el mismo shell.
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
import { motion, AnimatePresence } from "framer-motion";
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
    setMobileOpen(false);
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row relative bg-slate-50">
      {/* Mouse-follow-style decorative gradient (21st "Animated AI Chat"
          inspiration). Soft indigo→cyan radial top-right en mid-pane; un
          spot pink-500/8 bottom-left. Pointer-events:none, fixed atrás. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 10%, rgba(79, 70, 229, 0.07) 0%, transparent 50%), radial-gradient(circle at 20% 90%, rgba(236, 72, 153, 0.05) 0%, transparent 45%), radial-gradient(circle at 95% 50%, rgba(6, 182, 212, 0.06) 0%, transparent 40%)",
        }}
      />

      {/* Chat (middle pane, siempre presente). */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
        <ChatInterface onReady={handleChatReady} />
      </div>

      {/* Catálogo desktop (lg+) inline a la derecha. CatalogoSidebar ya es
          light internamente — solo aseguramos el wrapper coincida. */}
      <div className="relative z-10 hidden lg:flex lg:flex-col lg:w-96 xl:w-[400px] lg:shrink-0 lg:min-h-0 lg:border-l lg:border-slate-200 lg:bg-white">
        <CatalogoSidebar onCopyToChat={handleCopyToChat} />
      </div>

      {/* FAB para abrir catálogo en mobile/tablet. Pill gradient indigo→cyan
          con scale-on-hover, mismo lenguaje que el send button del composer. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-24 right-4 z-30 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-br from-indigo-600 to-cyan-500 border border-white/30 shadow-lg shadow-indigo-300/40 hover:shadow-indigo-400/60 hover:scale-105 transition"
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

      {/* Drawer mobile/tablet con AnimatePresence (slide-in desde la derecha). */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
            className="lg:hidden fixed inset-0 z-40 flex flex-col bg-white"
            role="dialog"
            aria-modal="true"
            aria-label="Catálogo Telcel"
          >
            <CatalogoSidebar
              onCopyToChat={handleCopyToChat}
              onClose={() => setMobileOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
