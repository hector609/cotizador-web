"use client";

/**
 * DashboardSidebar — sidebar fijo izquierdo del rediseño "REVENTAR mode"
 * (dark-glassmorphism premium tipo Linear/Vercel).
 *
 * NOTA DE TRANSICIÓN: este sidebar reemplaza la `DashboardNav` (topbar
 * blanco-corporativo) SOLO en `/dashboard` (home). El resto de páginas
 * (`/dashboard/historial`, `/clientes`, `/catalogos`, ...) siguen con la
 * nav legacy hasta que cada una migre. Por eso el sidebar vive como
 * componente local de la home, NO como `layout.tsx` (un layout aplicaría
 * a toda la subruta `/dashboard/*` y los dos navs se solaparían).
 *
 * Cuando el resto de páginas migre, mover este archivo a `_sidebar.tsx`
 * en el nivel del layout y borrar `_nav.tsx`.
 *
 * Responsive:
 *  - Desktop (lg+): sidebar fijo w-64 a la izquierda.
 *  - Mobile/tablet (< lg): se oculta y se muestra un botón hamburger que
 *    abre el sidebar como drawer via `<details>` nativo (sin estado React,
 *    sin JS extra).
 *
 * Activo: el caller pasa `active` como key (igual API que DashboardNav).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  icon: React.ReactNode;
  badge?: string;
}

const PRIMARY_LINKS: SidebarLink[] = [
  {
    key: "inicio",
    href: "/dashboard",
    label: "Inicio",
    icon: <HomeIcon />,
  },
  {
    key: "cotizar",
    href: "/dashboard/cotizar",
    label: "Cotizar",
    icon: <CalculatorIcon />,
    badge: "Nuevo",
  },
  {
    key: "historial",
    href: "/dashboard/historial",
    label: "Historial",
    icon: <HistoryIcon />,
  },
  {
    key: "clientes",
    href: "/dashboard/clientes",
    label: "Mis clientes",
    icon: <UsersIcon />,
  },
  {
    key: "catalogos",
    href: "/dashboard/catalogos",
    label: "Catálogo",
    icon: <InventoryIcon />,
  },
];

const SECONDARY_LINKS: SidebarLink[] = [
  {
    key: "optimizar",
    href: "/dashboard/optimizar",
    label: "Optimizar palancas",
    icon: <TrendingUpIcon />,
  },
  {
    key: "cotizar-excel",
    href: "/dashboard/cotizar-excel",
    label: "Importar Excel",
    icon: <UploadIcon />,
  },
];

interface DashboardSidebarProps {
  active: SidebarKey;
  /** Email del DAT logueado (para el cluster inferior). */
  email?: string;
  /** Iniciales (1-2 letras) para el avatar. */
  initials?: string;
}

export function DashboardSidebar({ active, email, initials }: DashboardSidebarProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      {/* Mobile top bar: logo + hamburger. Solo visible < lg. */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-[#060e20]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4">
        <Link
          href="/dashboard"
          className="text-base font-black tracking-tighter text-white"
        >
          Cotizador
        </Link>
        <button
          type="button"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-white/5 transition text-white"
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      <aside
        className={[
          // Desktop: fixed sidebar siempre visible.
          "fixed left-0 top-0 z-40 h-screen w-64 bg-[#060e20] border-r border-white/10 flex-col",
          "hidden lg:flex",
          // Mobile: se muestra como drawer cuando menuOpen.
          menuOpen
            ? "!flex !top-14 !h-[calc(100vh-3.5rem)] !w-full !z-30 lg:!top-0 lg:!h-screen lg:!w-64"
            : "",
        ].join(" ")}
        aria-label="Navegación principal"
      >
        {/* Header con logo + badge BETA */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-black tracking-tighter text-white text-xl"
          >
            Cotizador
          </Link>
          <span className="px-2 py-0.5 bg-cyan-400/15 text-cyan-300 text-[10px] font-bold rounded-full border border-cyan-400/30 tracking-wider">
            BETA
          </span>
        </div>

        {/* Search (decorativo por ahora — wired to nothing) */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cotización, RFC..."
              className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-full py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition"
              aria-label="Buscar"
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {PRIMARY_LINKS.map((l) => (
            <SidebarLinkItem key={l.key} link={l} active={l.key === active} />
          ))}

          <div className="pt-6 pb-2 px-3">
            <span className="text-[10px] text-slate-500 tracking-widest font-bold uppercase">
              Productividad
            </span>
          </div>
          {SECONDARY_LINKS.map((l) => (
            <SidebarLinkItem key={l.key} link={l} active={l.key === active} compact />
          ))}
        </nav>

        {/* User cluster inferior */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm border border-white/10">
              {initials || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {email ? email.split("@")[0] : "Vendedor"}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {email || "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="text-slate-400 hover:text-white transition p-1 disabled:opacity-50"
            >
              <LogoutIcon />
            </button>
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
  compact = false,
}: {
  link: SidebarLink;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex items-center gap-3 rounded-lg transition",
        compact ? "px-3 py-1.5 text-sm" : "px-3 py-2 text-[15px] font-medium",
        active
          ? "bg-white/8 text-white border border-white/10 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent",
      ].join(" ")}
    >
      {active && (
        <span
          className="absolute inset-y-1 left-0 w-1 bg-cyan-400 rounded-r-full shadow-[0_0_10px_rgba(34,211,238,0.6)]"
          aria-hidden="true"
        />
      )}
      <span aria-hidden="true" className={active ? "text-cyan-300" : ""}>
        {link.icon}
      </span>
      <span className="flex-1">{link.label}</span>
      {link.badge && (
        <span className="px-1.5 py-0.5 bg-cyan-400/15 text-cyan-300 text-[9px] font-bold rounded-full border border-cyan-400/30">
          {link.badge}
        </span>
      )}
    </Link>
  );
}

/* ---------- Icons (inline, mismo estilo que /components/icons) ---------- */

function HomeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"
      />
    </svg>
  );
}

function CalculatorIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path strokeLinecap="round" d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </svg>
  );
}

function HistoryIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 109-9M3 12V6m0 6h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
    </svg>
  );
}

function UsersIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 18a4 4 0 00-8 0M12 14a4 4 0 100-8 4 4 0 000 8zM20 19a3 3 0 00-3-3M4 19a3 3 0 013-3"
      />
    </svg>
  );
}

function InventoryIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7l8-4 8 4M4 7v10l8 4 8-4V7M4 7l8 4m0 0l8-4m-8 4v10"
      />
    </svg>
  );
}

function TrendingUpIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7" />
    </svg>
  );
}

function UploadIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function LogoutIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m0 0l4-4m-4 4l4 4M9 4h8a2 2 0 012 2v12a2 2 0 01-2 2H9" />
    </svg>
  );
}

function MenuIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
