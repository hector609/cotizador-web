"use client";

/**
 * useToast — hook + store global para el sistema de toasts LUMINA.
 *
 * Diseño:
 *   - Store externo (no React context) → cualquier módulo puede importar
 *     `toast` y disparar notificaciones sin estar dentro del provider.
 *   - El `<Toaster />` se suscribe vía `useSyncExternalStore` y renderiza
 *     la cola con framer-motion (slide-in / slide-out / layout reorder).
 *
 * API:
 *   toast.success("Guardado", { duration?: 4000, action?: { label, onClick } })
 *   toast.error("Algo falló")
 *   toast.warning("Cuidado…")
 *   toast.info("FYI")
 *   const id = toast.loading("Procesando…")  // no auto-dismiss
 *   toast.success("Listo", { id })            // promueve el loading a success
 *   toast.dismiss(id)                          // o forzar cierre
 *
 * Defaults:
 *   - duration: 4000ms (success/error/warning/info)
 *   - loading: sin auto-dismiss
 *   - hover sobre el toast pausa el timer (resume al salir).
 */

import { useSyncExternalStore } from "react";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** ms hasta auto-dismiss. `loading` ignora este valor. Default 4000. */
  duration?: number;
  /** Botón opcional inline (ej: "Reintentar"). */
  action?: ToastAction;
  /** Si se pasa, reemplaza un toast existente (útil para promover loading→success). */
  id?: string;
  /** Título opcional bold. Si no se da, usamos el mensaje como única línea. */
  title?: string;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
  action?: ToastAction;
  /** Timestamp creación, sólo para debugging / orden estable. */
  createdAt: number;
}

const DEFAULT_DURATION = 4000;
const MAX_TOASTS = 5;

type Listener = (toasts: ToastItem[]) => void;

class ToastStore {
  private toasts: ToastItem[] = [];
  private listeners = new Set<Listener>();
  // timers: por id, manejados por el Toaster (hover pausa) — el store mantiene
  // un set de ids "pinned" sin auto-dismiss (loading).
  private pinned = new Set<string>();

  getSnapshot = (): ToastItem[] => this.toasts;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  isPinned = (id: string): boolean => this.pinned.has(id);

  private emit() {
    for (const l of this.listeners) l(this.toasts);
  }

  private nextId(): string {
    // Crypto.randomUUID es estándar en navegadores modernos; fallback rápido.
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  push(type: ToastType, message: string, opts: ToastOptions = {}): string {
    const id = opts.id ?? this.nextId();
    const duration =
      type === "loading"
        ? Number.POSITIVE_INFINITY
        : opts.duration ?? DEFAULT_DURATION;

    const item: ToastItem = {
      id,
      type,
      message,
      title: opts.title,
      duration,
      action: opts.action,
      createdAt: Date.now(),
    };

    if (type === "loading") {
      this.pinned.add(id);
    } else {
      this.pinned.delete(id);
    }

    const existingIdx = this.toasts.findIndex((t) => t.id === id);
    if (existingIdx >= 0) {
      // Reemplazo (ej. loading → success).
      this.toasts = [
        ...this.toasts.slice(0, existingIdx),
        item,
        ...this.toasts.slice(existingIdx + 1),
      ];
    } else {
      // Append, respetando MAX_TOASTS (descartamos los más viejos).
      const next = [...this.toasts, item];
      this.toasts = next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
    }
    this.emit();
    return id;
  }

  dismiss(id: string) {
    const before = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.pinned.delete(id);
    if (this.toasts.length !== before) this.emit();
  }

  dismissAll() {
    if (this.toasts.length === 0) return;
    this.toasts = [];
    this.pinned.clear();
    this.emit();
  }
}

// Singleton compartido entre todos los call-sites (incluyendo HMR friendly:
// en dev Next.js puede recargar el módulo, pero el store recién creado
// se vuelve a suscribir al re-mount del Toaster, así que no necesitamos
// persistencia entre reloads).
export const toastStore = new ToastStore();

/**
 * API pública. Se puede importar desde cualquier componente client:
 *   import { toast } from "@/components/toast/useToast";
 *   toast.success("Guardado");
 */
export const toast = {
  success: (message: string, opts?: ToastOptions): string =>
    toastStore.push("success", message, opts),
  error: (message: string, opts?: ToastOptions): string =>
    toastStore.push("error", message, opts),
  warning: (message: string, opts?: ToastOptions): string =>
    toastStore.push("warning", message, opts),
  info: (message: string, opts?: ToastOptions): string =>
    toastStore.push("info", message, opts),
  loading: (message: string, opts?: ToastOptions): string =>
    toastStore.push("loading", message, opts),
  dismiss: (id: string): void => toastStore.dismiss(id),
  dismissAll: (): void => toastStore.dismissAll(),
};

/**
 * Hook React: devuelve la lista actual de toasts. Usado internamente por
 * `<Toaster />`. Los call-sites normales NO necesitan este hook — usan
 * directamente el objeto `toast` exportado arriba.
 */
export function useToast(): ToastItem[] {
  return useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    // Server snapshot: lista vacía. El Toaster se monta client-only via
    // "use client" en el componente padre.
    () => [],
  );
}
