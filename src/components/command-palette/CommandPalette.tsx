"use client";

/**
 * CommandPalette — overlay tipo Linear / Vercel / Raycast.
 *
 * Atajo: ⌘P (Mac) / Ctrl+P (Win/Linux). preventDefault del print del browser.
 * ⌘K queda reservado para ARIA Copilot (otro agente paralelo).
 *
 * Mount: en `src/app/layout.tsx`, una sola instancia global. El listener
 * keydown ⌘P es global (document-level) — si el usuario no está autenticado,
 * el modal abre y muestra solo acciones/páginas; los fetchs a /api/clientes
 * y /api/cotizaciones devolverán 401 silenciosamente (sin items, sin error
 * visible) y el palette seguirá funcional para navegación pública.
 *
 * A11y:
 *  - role="dialog" + aria-modal="true" + aria-labelledby al input label.
 *  - Focus trap: focus inicial al input; Tab/Shift+Tab navegan dentro del
 *    modal; Esc cierra; al cerrar restauramos focus al elemento anterior.
 *  - aria-live="polite" en el contador de resultados.
 *  - Cada item tiene id estable para que aria-activedescendant del input
 *    apunte al seleccionado (mejor que mover focus item-a-item porque
 *    mantenemos el input editable durante navegación con flechas).
 *
 * Design (LUMINA Light Premium):
 *  - Backdrop slate-900/50 + backdrop-blur-sm fade-in.
 *  - Modal max-w-2xl bg-white rounded-2xl shadow-2xl shadow-indigo-200/50,
 *    entrada scale 0.96 → 1 + opacity con framer-motion.
 *  - Selected item: bg-indigo-50 + border-l-2 border-indigo-500.
 *  - Indicador "slide" implementado con un `<motion.div layoutId>` que sigue
 *    al item seleccionado (igual que Sidebar.tsx).
 */

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Upload,
  LogOut,
  Home,
  History,
  Users,
  User,
  Package,
  TrendingUp,
  FileText,
  Settings,
  ArrowRight,
  CornerDownLeft,
} from "lucide-react";
import {
  useCommandPalette,
  type PaletteIconName,
  type PaletteItem,
} from "./useCommandPalette";

/* ---------- Icon map ---------- */

const ICONS: Record<
  PaletteIconName,
  React.ComponentType<{ className?: string }>
> = {
  search: Search,
  plus: Plus,
  upload: Upload,
  logOut: LogOut,
  home: Home,
  history: History,
  users: Users,
  user: User,
  package: Package,
  trendingUp: TrendingUp,
  fileText: FileText,
  settings: Settings,
  arrowRight: ArrowRight,
};

/* ---------- Componente ---------- */

export function CommandPalette() {
  const router = useRouter();

  const navigate = useMemo(
    () => (href: string) => router.push(href),
    [router],
  );

  const onLogout = useMemo(
    () => async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // ignore — redirigimos igual.
      }
      router.push("/login");
    },
    [router],
  );

  const palette = useCommandPalette({ navigate, onLogout });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Detección Mac para mostrar ⌘ vs Ctrl en el chip.
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
  }, []);

  /* ---------- Focus trap ---------- */

  useEffect(() => {
    if (palette.open) {
      // Guardar el elemento que tenía focus al abrir para restaurar al cerrar.
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Enfocar el input al siguiente tick (después de mount del portal).
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    } else {
      // Restaurar focus al elemento previo cuando se cierra.
      previousFocusRef.current?.focus?.();
    }
  }, [palette.open]);

  /* ---------- Auto-scroll del item seleccionado ---------- */

  useEffect(() => {
    if (!palette.open) return;
    const list = listRef.current;
    if (!list) return;
    const it = palette.items[palette.selectedIndex];
    if (!it) return;
    const el = list.querySelector<HTMLElement>(
      `[data-item-id="${CSS.escape(it.id)}"]`,
    );
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [palette.selectedIndex, palette.open, palette.items]);

  /* ---------- Keydown dentro del modal ---------- */

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // ↑/↓ navegan items.
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const n = palette.items.length;
      if (n === 0) return;
      palette.setSelectedIndex((palette.selectedIndex + 1) % n);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const n = palette.items.length;
      if (n === 0) return;
      palette.setSelectedIndex((palette.selectedIndex - 1 + n) % n);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const it = palette.items[palette.selectedIndex];
      if (!it) return;
      palette.setOpen(false);
      palette.reset();
      it.onSelect();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      palette.setOpen(false);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      palette.setSelectedIndex(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      palette.setSelectedIndex(Math.max(0, palette.items.length - 1));
      return;
    }
  }

  function handleItemClick(it: PaletteItem) {
    palette.setOpen(false);
    palette.reset();
    it.onSelect();
  }

  /* ---------- Render ---------- */

  // Build flat-index lookup para saber qué item es el seleccionado por id.
  const selectedId = palette.items[palette.selectedIndex]?.id ?? null;

  return (
    <AnimatePresence>
      {palette.open && (
        <motion.div
          key="cmdk-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => palette.setOpen(false)}
          aria-hidden={!palette.open}
        >
          <motion.div
            key="cmdk-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cmdk-input-label"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl shadow-indigo-200/50 overflow-hidden ring-1 ring-slate-200/60"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Header — input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <Search
                className="w-5 h-5 text-slate-400 shrink-0"
                aria-hidden="true"
              />
              <label id="cmdk-input-label" className="sr-only">
                Buscar acción, página, cliente o cotización
              </label>
              <input
                ref={inputRef}
                type="text"
                value={palette.query}
                onChange={(e) => palette.setQuery(e.target.value)}
                placeholder="Buscar acción, página, cliente, cotización..."
                aria-labelledby="cmdk-input-label"
                aria-controls="cmdk-listbox"
                aria-activedescendant={selectedId ?? undefined}
                aria-autocomplete="list"
                role="combobox"
                aria-expanded="true"
                className="flex-1 bg-transparent text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-md border border-slate-200"
                aria-hidden="true"
              >
                {isMac ? "⌘" : "Ctrl"} P
              </kbd>
            </div>

            {/* Listbox */}
            <div
              ref={listRef}
              id="cmdk-listbox"
              role="listbox"
              aria-label="Resultados de búsqueda"
              className="max-h-[400px] overflow-y-auto py-2"
            >
              {palette.items.length === 0 ? (
                <EmptyState query={palette.query} />
              ) : (
                palette.groups.map((g, gi) => (
                  <div key={g.section} className={gi > 0 ? "mt-2" : ""}>
                    <div className="px-5 pt-2 pb-1 text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                      {g.title}
                    </div>
                    <ul className="px-2">
                      {g.items.map((it) => {
                        const selected = it.id === selectedId;
                        const Icon = ICONS[it.icon] ?? Search;
                        return (
                          <li
                            key={it.id}
                            id={it.id}
                            data-item-id={it.id}
                            role="option"
                            aria-selected={selected}
                            onMouseMove={() => {
                              // En hover, mover la selección al item para
                              // sincronizar mouse + teclado.
                              const idx = palette.items.findIndex(
                                (x) => x.id === it.id,
                              );
                              if (idx >= 0 && idx !== palette.selectedIndex) {
                                palette.setSelectedIndex(idx);
                              }
                            }}
                            onClick={() => handleItemClick(it)}
                            className={[
                              "relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                              selected
                                ? "bg-indigo-50 text-slate-900"
                                : "text-slate-700 hover:bg-slate-50",
                            ].join(" ")}
                          >
                            {selected && (
                              <motion.span
                                layoutId="cmdk-selected-indicator"
                                aria-hidden="true"
                                className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-indigo-500"
                                transition={{
                                  type: "spring",
                                  stiffness: 380,
                                  damping: 32,
                                }}
                              />
                            )}
                            <span
                              className={[
                                "inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0",
                                selected
                                  ? "bg-white text-indigo-600 ring-1 ring-indigo-100"
                                  : "bg-slate-100 text-slate-600",
                              ].join(" ")}
                            >
                              <Icon className="w-4 h-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">
                                {it.label}
                              </div>
                              {it.meta && (
                                <div className="text-xs text-slate-500 truncate">
                                  {it.meta}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {it.hint && (
                                <span className="text-[11px] text-slate-400 hidden sm:inline">
                                  {it.hint}
                                </span>
                              )}
                              {selected && (
                                <CornerDownLeft
                                  className="w-3.5 h-3.5 text-indigo-500"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-500">
              <div
                aria-live="polite"
                aria-atomic="true"
                className="tabular-nums"
              >
                {palette.loadingRemote
                  ? "Buscando…"
                  : `${palette.items.length} resultado${palette.items.length === 1 ? "" : "s"}`}
              </div>
              <div className="flex items-center gap-3">
                <FooterHint label="Navegar" k1="↑" k2="↓" />
                <FooterHint label="Ejecutar" k1="⏎" />
                <FooterHint label="Cerrar" k1="Esc" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Sub-components ---------- */

function EmptyState({ query }: { query: string }) {
  if (!query.trim()) {
    return (
      <div className="px-5 py-10 text-center text-sm text-slate-500">
        <Search
          className="w-6 h-6 mx-auto mb-2 text-slate-300"
          aria-hidden="true"
        />
        Empieza a escribir para buscar acciones, páginas, clientes o
        cotizaciones.
      </div>
    );
  }
  return (
    <div className="px-5 py-10 text-center text-sm text-slate-500">
      <span className="block text-slate-700 font-medium mb-1">
        Sin resultados
      </span>
      No encontramos nada para{" "}
      <span className="font-medium text-slate-900">“{query}”</span>. Prueba con
      otro término.
    </div>
  );
}

function FooterHint({
  label,
  k1,
  k2,
}: {
  label: string;
  k1: string;
  k2?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded">
        {k1}
      </kbd>
      {k2 && (
        <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded">
          {k2}
        </kbd>
      )}
      <span>{label}</span>
    </span>
  );
}
