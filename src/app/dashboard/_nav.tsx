"use client";

/**
 * DashboardNav — header + tabs unificadas del dashboard del DAT.
 *
 * Antes cada página tenía su propio <header><nav>...</nav></header> inline
 * (6 variaciones distintas con tabs distintas y "Salir" apuntando a `/`,
 * que llevaba al landing público sin invalidar la cookie). Esta versión:
 *
 *   - Centraliza tabs principales en TABS_MAIN.
 *   - Resalta el tab activo via `usePathname()` (match exacto para "Inicio",
 *     `startsWith` para el resto) — o vía prop `active` si se quiere forzar
 *     (útil para rutas anidadas tipo /dashboard/cliente/[rfc] que conceptualmente
 *     viven dentro de "Clientes").
 *   - Agrega un cluster derecho con "Configuración" (icono ⚙) y "Salir" en
 *     estilo discreto.
 *   - "Salir" hace POST a /api/auth/logout y redirige a /login. Antes era un
 *     <Link href="/"> que solo regresaba al landing — la cookie de sesión
 *     seguía válida (bug de seguridad menor + UX confuso).
 *
 * Uso:
 *   import { DashboardNav } from "@/app/dashboard/_nav";
 *   <DashboardNav />                       // detección automática vía pathname
 *   <DashboardNav active="cotizar" />      // forzar tab activo (override)
 *   <DashboardNav showHomeTitle />         // muestra el H1 corporativo (solo
 *                                          // en /dashboard home)
 */

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

interface Tab {
  /** Key estable para usar con la prop `active`. */
  key: TabKey;
  href: string;
  label: string;
  /** Si es true, el match automático es exacto; si no, usa startsWith. */
  exact?: boolean;
}

export type TabKey =
  | "inicio"
  | "cotizar"
  | "optimizar"
  | "historial"
  | "clientes"
  | "catalogos";

const TABS_MAIN: Tab[] = [
  { key: "inicio", href: "/dashboard", label: "Inicio", exact: true },
  { key: "cotizar", href: "/dashboard/cotizar", label: "Cotizar" },
  { key: "optimizar", href: "/dashboard/optimizar", label: "Optimizar" },
  { key: "historial", href: "/dashboard/historial", label: "Historial" },
  { key: "clientes", href: "/dashboard/clientes", label: "Clientes" },
  { key: "catalogos", href: "/dashboard/catalogos", label: "Catálogos" },
];

interface DashboardNavProps {
  /** Forzar el tab activo (override del auto-detect por pathname). */
  active?: TabKey;
  /**
   * Si true, muestra el H1 "Cotizador Inteligente para DATS" pegado a la
   * izquierda. Solo debe pasarse en /dashboard (home). En las páginas hijas
   * el H1 es ruido visual repetido — el tab activo ya indica dónde estás.
   */
  showHomeTitle?: boolean;
}

export function DashboardNav({ active, showHomeTitle = false }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  function isActive(t: Tab): boolean {
    if (active) return t.key === active;
    return t.exact
      ? pathname === t.href
      : pathname === t.href || pathname.startsWith(`${t.href}/`);
  }

  async function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignoramos errores de red — la redirección es lo importante. Aun si
      // el POST falla, la cookie tiene `exp` y eventualmente se invalida.
    } finally {
      router.push("/login");
    }
  }

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          {showHomeTitle && (
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate shrink-0">
              Cotizador Inteligente para DATS
            </h1>
          )}
          <nav
            className="flex items-center gap-1 text-sm overflow-x-auto"
            aria-label="Secciones del dashboard"
          >
            {TABS_MAIN.map((t) => {
              const a = isActive(t);
              return (
                <Link
                  key={t.key}
                  href={t.href}
                  aria-current={a ? "page" : undefined}
                  className={[
                    "px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap",
                    a
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Cluster derecho discreto: Configuración + Salir. Va separado del
            grupo de tabs para que visualmente no compita con la navegación
            principal (son acciones de cuenta, no secciones del producto). */}
        <div className="flex items-center gap-1 text-xs sm:text-sm shrink-0">
          <Link
            href="/dashboard/configuracion"
            aria-current={
              pathname === "/dashboard/configuracion" ? "page" : undefined
            }
            title="Configuración de la cuenta"
            className={[
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md transition",
              pathname === "/dashboard/configuracion"
                ? "text-blue-700 bg-blue-50"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
            ].join(" ")}
          >
            <GearIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Configuración</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-2.5 py-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Cerrar sesión"
          >
            {loggingOut ? "Saliendo…" : "Salir"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------- Icono local (mantiene self-contained) ---------- */

function GearIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
