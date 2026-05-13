"use client";

/**
 * CotizarLayout — composición client-side de la página /dashboard/cotizar.
 *
 * REDISEÑO LUMINA Light Premium (pivot 2026-05-13). Shell light tipo Linear
 * cuando rediseñaron a fondo: `bg-slate-50` global, surfaces `bg-white`,
 * paleta indigo-600 (#4F46E5) + cyan-500 (#06B6D4) + pink-500 (#EC4899).
 * Cero glassmorphism dark, cero `#0b1326`.
 *
 * Layout (pivot 2026-05-13 PM — catálogo como DRAWER):
 *   ┌──────────┬────────────────────────────────────────────┐
 *   │ Sidebar  │      ChatInterface (ancho COMPLETO)        │
 *   │ (left)   │      bg-slate-50                           │
 *   │ owned by │      composer y mensajes respiran          │
 *   │ parent   │                                            │
 *   └──────────┴────────────────────────────────────────────┘
 *
 * El catálogo Telcel YA NO ocupa ancho del layout principal: vive en un
 * drawer overlay (estilo Stripe Dashboard right panel) que se abre desde
 * un botón pill en el topbar del chat. Backdrop semi-transparente +
 * blur. Click backdrop, click X o tecla Escape cierran el drawer.
 *
 * Bridge chat↔catálogo:
 *   - `ChatInterface` expone una API `{append}` vía prop `onReady`.
 *   - Guardamos esa API en un ref del layout.
 *   - El panel de catálogo recibe un callback `onCopyToChat` que llama
 *     `api.append(text)`. Si el chat aún no publicó la API (race), el
 *     callback es no-op (defensivo).
 *   - El toggle button del catálogo lo renderiza `ChatInterface` en su
 *     topbar; el layout le pasa `catalogoOpen` + `onToggleCatalogo`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChatInterface,
  type ChatInterfaceApi,
} from "./ChatInterface";
import { CatalogoSidebar } from "@/components/catalogo/CatalogoSidebar";

export function CotizarLayout() {
  const chatApiRef = useRef<ChatInterfaceApi | null>(null);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleChatReady = useCallback((api: ChatInterfaceApi) => {
    chatApiRef.current = api;
  }, []);

  const handleCopyToChat = useCallback((text: string) => {
    chatApiRef.current?.append(text);
    // No cerramos automáticamente: el vendedor puede querer copiar varias
    // líneas (e.g. plan + equipo) antes de regresar al chat.
  }, []);

  const closeCatalogo = useCallback(() => {
    setCatalogoOpen(false);
  }, []);

  const toggleCatalogo = useCallback(() => {
    setCatalogoOpen((prev) => !prev);
  }, []);

  // Escape cierra el drawer cuando está abierto.
  useEffect(() => {
    if (!catalogoOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setCatalogoOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [catalogoOpen]);

  // Focus management básico: al abrir, recordamos el foco previo y movemos
  // foco al drawer. Al cerrar, restauramos al elemento previo (el toggle).
  useEffect(() => {
    if (catalogoOpen) {
      previouslyFocusedRef.current =
        typeof document !== "undefined"
          ? (document.activeElement as HTMLElement | null)
          : null;
      // Defer al siguiente tick para que motion ya haya montado el div.
      const id = window.setTimeout(() => {
        drawerRef.current?.focus();
      }, 30);
      return () => window.clearTimeout(id);
    }
    // Al cerrar: restaurar foco.
    const prev = previouslyFocusedRef.current;
    if (prev && typeof prev.focus === "function") {
      // Pequeño defer para evitar pelearse con AnimatePresence.
      const id = window.setTimeout(() => prev.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [catalogoOpen]);

  return (
    <div className="flex-1 min-h-0 flex flex-col relative bg-slate-50">
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

      {/* Chat ocupa el ancho COMPLETO del shell. El catálogo vive en un
          drawer overlay y no resta ancho del layout principal. */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
        <ChatInterface
          onReady={handleChatReady}
          catalogoOpen={catalogoOpen}
          onToggleCatalogo={toggleCatalogo}
        />
      </div>

      {/* Drawer overlay: backdrop con fade + panel slide-in desde la derecha.
          Aplica en TODO viewport (mobile, tablet, desktop) — el catálogo
          siempre vive en un drawer que no interfiere con el chat. */}
      <AnimatePresence>
        {catalogoOpen && (
          <>
            <motion.div
              key="catalogo-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={closeCatalogo}
              className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              key="catalogo-drawer"
              ref={drawerRef}
              tabIndex={-1}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", ease: "easeOut", duration: 0.28 }}
              className="fixed top-0 right-0 bottom-0 z-50 flex flex-col w-full sm:w-96 bg-white shadow-2xl shadow-slate-900/10 border-l border-slate-200 focus:outline-none"
              role="dialog"
              aria-modal="true"
              aria-labelledby="catalogo-drawer-title"
            >
              {/* Reaprovechamos el header interno de CatalogoSidebar (h2 +
                  close button). El h2 ya tiene texto "Catálogo Telcel"; le
                  pasamos id implícito a través de su markup — aquí inyectamos
                  un wrapper con id para que aria-labelledby ancle. */}
              <div id="catalogo-drawer-title" className="sr-only">
                Catálogo Telcel
              </div>
              <CatalogoSidebar
                onCopyToChat={handleCopyToChat}
                onClose={closeCatalogo}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
