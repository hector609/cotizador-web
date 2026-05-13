"use client";

/**
 * Sidebar — LUMINA Light Premium.
 *
 * Pivot total desde el shell dark anterior. Ahora:
 *  - bg-white + border-r border-slate-200
 *  - INDIGO #4F46E5 primary, CYAN #06B6D4 accent, PINK #EC4899 pop
 *  - Active state pill bg-indigo-50 + text-indigo-700 + motion layoutId indicator
 *  - Pill buttons rounded-full, lucide outline icons
 *
 * IMPORTANTE: la API pública del componente (props, SidebarKey) se mantiene
 * para no romper las 6 páginas que ya lo consumen. Solo cambia la skin.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Plus,
  History,
  Users,
  Package,
  TrendingUp,
  Upload,
  Search,
  LogOut,
  Menu,
  X,
  Settings,
  LifeBuoy,
  ChevronsUpDown,
} from "lucide-react";

export type SidebarKey =
  | "inicio"
  | "cotizar"
  | "historial"
  | "clientes"
  | "catalogos"
  | "optimizar";

interface SidebarLink {
  key: SidebarKey | string;
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const PRIMARY_LINKS: SidebarLink[] = [
  { key: "inicio", href: "/dashboard", label: "Inicio", Icon: Home },
  {
    key: "cotizar",
    href: "/dashboard/cotizar",
    label: "Cotizar",
    Icon: Plus,
    badge: "Nuevo",
  },
  {
    key: "historial",
    href: "/dashboard/historial",
    label: "Historial",
    Icon: History,
  },
];

const SECONDARY_LINKS: SidebarLink[] = [
  {
    key: "clientes",
    href: "/dashboard/clientes",
    label: "Mis clientes",
    Icon: Users,
  },
  {
    key: "catalogos",
    href: "/dashboard/catalogos",
    label: "Catálogo",
    Icon: Package,
  },
  {
    key: "optimizar",
    href: "/dashboard/optimizar",
    label: "Optimizar palancas",
    Icon: TrendingUp,
  },
  {
    key: "cotizar-excel",
    href: "/dashboard/cotizar-excel",
    label: "Importar Excel",
    Icon: Upload,
  },
];

interface SidebarProps {
  active: SidebarKey;
  userLabel?: string;
  userSubtitle?: string;
  initials?: string;
}

export function Sidebar({
  active,
  userLabel,
  userSubtitle,
  initials,
}: SidebarProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  async function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Igual redirigimos; la cookie eventualmente expira.
    } finally {
      router.push("/login");
    }
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4">
        <Link
          href="/dashboard"
          className="text-base font-extrabold tracking-tight text-slate-900"
        >
          Cotizador
        </Link>
        <button
          type="button"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition text-slate-700"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <aside
        className={[
          "fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex-col",
          "hidden lg:flex",
          menuOpen
            ? "!flex !top-14 !h-[calc(100vh-3.5rem)] !w-full !z-30 lg:!top-0 lg:!h-screen lg:!w-64"
            : "",
        ].join(" ")}
        aria-label="Navegación principal"
      >
        {/* Header: logo + BETA pill */}
        <div className="px-6 py-5 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-extrabold tracking-tight text-slate-900 text-xl"
          >
            Cotizador
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gradient-to-r from-emerald-100 to-cyan-100 text-emerald-700 text-[10px] font-bold rounded-full tracking-wider">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            BETA
          </span>
        </div>

        {/* Search */}
        <div className="px-4 pb-4">
          <label htmlFor="sidebar-search" className="sr-only">
            Buscar
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="sidebar-search"
              type="text"
              placeholder="Buscar..."
              className="w-full bg-slate-100 border border-transparent rounded-full py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition"
              aria-label="Buscar"
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          <p className="px-3 pt-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Principal
          </p>
          {PRIMARY_LINKS.map((l) => (
            <SidebarLinkItem key={l.key} link={l} active={l.key === active} />
          ))}

          <p className="px-3 pt-6 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Productividad
          </p>
          {SECONDARY_LINKS.map((l) => (
            <SidebarLinkItem key={l.key} link={l} active={l.key === active} />
          ))}
        </nav>

        {/* Bottom: settings + user */}
        <div className="border-t border-slate-100 p-3 space-y-0.5">
          <Link
            href="/dashboard/configuracion"
            className="flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <Settings className="w-4 h-4" />
            Configuración
          </Link>
          <a
            href="https://instagram.com/hectoria.mx"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <LifeBuoy className="w-4 h-4" />
            Soporte
          </a>

          {/* User card + dropdown */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              aria-expanded={userOpen}
              aria-label="Menú de usuario"
              className="w-full flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-slate-50 transition group"
            >
              <span className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {initials || "U"}
              </span>
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-sm font-bold text-slate-900 truncate">
                  {userLabel || "Vendedor"}
                </span>
                <span className="block text-xs text-slate-500 truncate">
                  {userSubtitle || "—"}
                </span>
              </span>
              <ChevronsUpDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
            </button>
            <AnimatePresence>
              {userOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="mt-1 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/40 p-1"
                >
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    aria-label="Cerrar sesión"
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ---------- Sub-componentes ---------- */

function SidebarLinkItem({
  link,
  active,
}: {
  link: SidebarLink;
  active: boolean;
}) {
  const Icon = link.Icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "text-indigo-700"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
      ].join(" ")}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute inset-0 rounded-full bg-indigo-50"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          aria-hidden="true"
        />
      )}
      <Icon
        className={[
          "relative w-4 h-4 shrink-0",
          active ? "text-indigo-600" : "text-slate-400",
        ].join(" ")}
      />
      <span className="relative flex-1">{link.label}</span>
      {link.badge && (
        <span className="relative inline-flex items-center px-1.5 py-0.5 bg-pink-500 text-white text-[9px] font-bold rounded-md uppercase tracking-wide">
          {link.badge}
        </span>
      )}
    </Link>
  );
}
