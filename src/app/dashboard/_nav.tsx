"use client";

/**
 * DashboardNav — tabs para el dashboard del DAT.
 *
 * Por qué este archivo existe:
 *   /dashboard/page.tsx lo está editando otro agente, así que no podemos
 *   modificarlo en este commit. Este componente queda listo para que ese
 *   agente (o un commit posterior) lo importe:
 *
 *     import { DashboardNav } from "@/app/dashboard/_nav";
 *     ...
 *     <DashboardNav />
 *
 *   El prefijo `_` evita que Next.js trate la carpeta como ruta. Aunque hoy
 *   el archivo vive a nivel de page (mismo directorio), si en el futuro se
 *   convierte en `_components/Nav.tsx` o se promueve a `src/components/`,
 *   actualizar este import en cualquier consumidor.
 *
 * Estado activo: usa `usePathname()` y compara con `startsWith` para que las
 * rutas anidadas (p.ej. `/dashboard/historial/123`) sigan marcando el tab
 * correcto. La tab "Inicio" es match exacto para no quedarse activa siempre.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  href: string;
  label: string;
  /** Si es true, el match es exacto; si no, usa startsWith. */
  exact?: boolean;
}

const TABS: Tab[] = [
  { href: "/dashboard", label: "Inicio", exact: true },
  { href: "/dashboard/cotizar", label: "Cotizar" },
  { href: "/dashboard/historial", label: "Historial" },
  { href: "/dashboard/clientes", label: "Clientes" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-1 text-sm"
      aria-label="Secciones del dashboard"
    >
      {TABS.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={[
              "px-3 py-1.5 rounded-md font-medium transition",
              active
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
