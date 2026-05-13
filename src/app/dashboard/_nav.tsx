"use client";

/**
 * DashboardNav — topbar unificada del dashboard del DAT.
 *
 * Capa de presentación premium B2B. Layout:
 *
 *   [Logo "Cotizador"]  [Cotizar Historial Clientes Catálogo ...]  [⚙ Avatar]
 *
 * Responsive:
 *   - Desktop (md+): tabs inline + cluster usuario derecha.
 *   - Mobile (< md): logo + hamburger que abre `<details>` con tabs stackeados
 *     y acciones de cuenta (Configuración / Salir). Audit B3.
 *
 * El menú de usuario también vive en `<details>` para evitar dependencias de
 * estado externo y para que funcione si JS falla (graceful degradation —
 * `<details>` es nativo).
 *
 * Logo: por instrucción explícita NO inventamos SVG. Mantenemos texto
 * "Cotizador" con peso bold + tracking-tight como wordmark provisional.
 *
 * Roles: el dropdown del usuario muestra "Admin" cuando aplica para que el
 * vendedor sepa qué cuenta tiene. La sección Admin del menú principal NO se
 * agrega aún (no hay route /dashboard/admin estable); cuando exista, mapear
 * `session.role === "admin"` → tab condicional aquí.
 */

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bars3Icon, XMarkIcon } from "@/components/icons";

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
   * Compat con código existente que pasaba `showHomeTitle` para mostrar el
   * H1 corporativo. El rediseño mueve el H1 al body de cada página (audit
   * A1), así que este prop se ignora — lo dejamos en la interfaz para no
   * romper callers durante la transición.
   */
  showHomeTitle?: boolean;
}

export function DashboardNav({ active }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const mobileDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const userDetailsRef = useRef<HTMLDetailsElement | null>(null);

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
      // Ignoramos errores de red — la redirección es lo importante. Aun
      // si el POST falla, la cookie tiene `exp` y eventualmente expira.
    } finally {
      router.push("/login");
    }
  }

  // Cierra los <details> al navegar (cambio de pathname). Sin esto el
  // dropdown queda abierto entre clicks y se ve "pegado".
  useEffect(() => {
    if (mobileDetailsRef.current?.open) {
      mobileDetailsRef.current.open = false;
    }
    if (userDetailsRef.current?.open) {
      userDetailsRef.current.open = false;
    }
  }, [pathname]);

  // Cierra el dropdown del usuario al clickear fuera. El <details> nativo
  // no hace esto por sí mismo.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const d = userDetailsRef.current;
      if (!d || !d.open) return;
      if (e.target instanceof Node && !d.contains(e.target)) {
        d.open = false;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Logo + nav desktop */}
        <div className="flex items-center gap-8 min-w-0">
          <Link
            href="/dashboard"
            className="text-base sm:text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap"
            aria-label="Cotizador — Ir al inicio"
          >
            Cotizador
          </Link>

          {/* Nav desktop (md+). En mobile se mueve al drawer del hamburger. */}
          <nav
            className="hidden md:flex items-center gap-1 text-sm"
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

        {/* Cluster derecho: user menu desktop + hamburger mobile */}
        <div className="flex items-center gap-2">
          {/* User dropdown desktop */}
          <details
            ref={userDetailsRef}
            className="relative hidden md:block"
          >
            <summary
              className="list-none cursor-pointer inline-flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Menú de cuenta"
            >
              <UserAvatar />
              <svg
                className="w-4 h-4 text-slate-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <div
              className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-40"
              role="menu"
            >
              <Link
                href="/dashboard/configuracion"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                role="menuitem"
              >
                Configuración
              </Link>
              <Link
                href="/dashboard/configuracion"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                role="menuitem"
              >
                Perfil
              </Link>
              <div className="border-t border-slate-100 my-1" />
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                role="menuitem"
              >
                {loggingOut ? "Saliendo…" : "Cerrar sesión"}
              </button>
            </div>
          </details>

          {/* Hamburger mobile */}
          <details ref={mobileDetailsRef} className="md:hidden group">
            <summary
              className="list-none cursor-pointer inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Abrir menú"
            >
              <Bars3Icon className="w-6 h-6 text-slate-700 group-open:hidden" />
              <XMarkIcon className="w-6 h-6 text-slate-700 hidden group-open:block" />
            </summary>
            <div className="fixed inset-x-0 top-16 bottom-0 z-30 bg-white border-t border-slate-200 overflow-y-auto">
              <nav
                className="px-4 py-4 space-y-1"
                aria-label="Navegación móvil"
              >
                {TABS_MAIN.map((t) => {
                  const a = isActive(t);
                  return (
                    <Link
                      key={t.key}
                      href={t.href}
                      aria-current={a ? "page" : undefined}
                      className={[
                        "block px-4 py-3 rounded-lg text-base font-medium transition",
                        a
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {t.label}
                    </Link>
                  );
                })}
                <div className="border-t border-slate-200 my-2" />
                <Link
                  href="/dashboard/configuracion"
                  className="block px-4 py-3 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-50"
                >
                  Configuración
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="block w-full text-left px-4 py-3 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {loggingOut ? "Saliendo…" : "Cerrar sesión"}
                </button>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

/* ---------- Sub-componentes ---------- */

function UserAvatar() {
  // Avatar provisional con inicial estática "U". Si en el futuro la sesión
  // expone `nombre` o `email`, derivar la inicial. La inicial es decorativa
  // — el alt-text "Menú de cuenta" lo da el summary.
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold"
    >
      U
    </span>
  );
}
