"use client";

/**
 * useCommandPalette — state + side-effects para el Command Palette global
 * estilo Linear / Vercel / Raycast.
 *
 * Responsabilidades:
 *  - Estado: open/closed, query, selectedIndex.
 *  - Listener global keydown (⌘P / Ctrl+P para abrir, preventDefault del
 *    print del browser). ⌘K queda reservado para ARIA Copilot (otro agente).
 *  - Fetch remoto debounced para clientes / equipos / planes (200ms).
 *  - Fetch one-shot de cotizaciones recientes al abrir.
 *  - Construcción de la lista plana de "items" navegable con teclado y
 *    agrupada visualmente por sección.
 *
 * Decisiones:
 *  - SCRATCH (no `cmdk`): evitamos sumar dep nueva, controlamos 100% del
 *    look LUMINA y de la a11y. La lógica de filtrado es trivial para el
 *    volumen esperado (<300 items en pantalla simultáneos).
 *  - Filtros locales por prefix/substring sobre cada sección — los fetchs
 *    de catálogo / clientes ya vienen pre-filtrados desde el backend con
 *    `q=` cuando hay query no vacía. Cuando la query está vacía mostramos:
 *      acciones + páginas + cotizaciones recientes + top clientes (sin
 *      catálogo, que es ruidoso si no hay query).
 *  - selectedIndex es global a la lista visible (todos los items en
 *    flat order) — ↑/↓ saltan entre items sin importar la sección.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Cotizacion } from "@/types/cotizacion";

/* ---------- Tipos ---------- */

export type PaletteSection =
  | "acciones"
  | "paginas"
  | "clientes"
  | "cotizaciones"
  | "catalogo";

export interface PaletteItem {
  /** Stable id (sección:slug). Usado como key y como anchor de a11y. */
  id: string;
  section: PaletteSection;
  label: string;
  /** Texto secundario opcional (RFC, folio, marca, etc.). */
  meta?: string;
  /** Texto pequeño a la derecha (shortcut, fecha, badge). */
  hint?: string;
  /** Nombre de icono lucide-react. El componente lo mapea a JSX. */
  icon: PaletteIconName;
  /** Texto de búsqueda enriquecido. Lowercased en build-time. */
  searchText: string;
  /** Acción a ejecutar al presionar Enter / click. */
  onSelect: () => void;
}

export type PaletteIconName =
  | "search"
  | "plus"
  | "upload"
  | "logOut"
  | "home"
  | "history"
  | "users"
  | "user"
  | "package"
  | "trendingUp"
  | "fileText"
  | "settings"
  | "arrowRight";

interface ClienteRow {
  rfc: string;
  nombre?: string;
  razon_social?: string;
}

interface ClientesApiResponse {
  clientes?: ClienteRow[];
}

interface CotizacionesApiResponse {
  cotizaciones?: Cotizacion[];
}

interface EquipoRow {
  marca: string;
  modelo: string;
}

interface EquiposApiResponse {
  equipos?: EquipoRow[];
}

interface PlanRow {
  clave?: string | null;
  nombre?: string | null;
  grupo?: string | null;
  modalidad?: string | null;
  plazo?: number | null;
  renta?: number | null;
}

interface PlanesApiResponse {
  planes?: PlanRow[];
}

interface NavigateFn {
  (href: string): void;
}

interface UseCommandPaletteOptions {
  navigate: NavigateFn;
  /** Handler de logout — inyectado para no acoplar al fetch en este hook. */
  onLogout: () => void;
}

interface UseCommandPaletteReturn {
  open: boolean;
  query: string;
  setQuery: (q: string) => void;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  items: PaletteItem[];
  /** Items agrupados por sección para render, en el mismo orden que `items`. */
  groups: Array<{ section: PaletteSection; title: string; items: PaletteItem[] }>;
  loadingRemote: boolean;
  /** Ejecuta el item seleccionado actualmente. */
  runSelected: () => void;
  /** Acuse explícito para reset desde el componente. */
  reset: () => void;
}

/* ---------- Constantes ---------- */

const SECTION_TITLES: Record<PaletteSection, string> = {
  acciones: "Acciones",
  paginas: "Páginas",
  clientes: "Clientes",
  cotizaciones: "Cotizaciones recientes",
  catalogo: "Catálogo",
};

const SECTION_ORDER: PaletteSection[] = [
  "acciones",
  "paginas",
  "cotizaciones",
  "clientes",
  "catalogo",
];

const DEBOUNCE_MS = 200;
const RECENT_LIMIT = 10;
const REMOTE_LIMIT = 8;

/* ---------- Helpers ---------- */

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function matchesQuery(item: PaletteItem, normQuery: string): boolean {
  if (!normQuery) return true;
  return item.searchText.includes(normQuery);
}

function fmtFolio(c: Cotizacion): string {
  // Mostrar primeros 8 chars del UUID como pseudo-folio.
  return c.id ? `#${c.id.slice(0, 8)}` : "—";
}

function fmtFecha(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
    }).format(d);
  } catch {
    return "";
  }
}

/* ---------- Hook principal ---------- */

export function useCommandPalette({
  navigate,
  onLogout,
}: UseCommandPaletteOptions): UseCommandPaletteReturn {
  const [open, setOpenState] = useState(false);
  const [query, setQueryState] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [recientes, setRecientes] = useState<Cotizacion[]>([]);
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [planes, setPlanes] = useState<PlanRow[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  // AbortControllers para cancelar fetches obsoletos cuando la query cambia.
  const abortRef = useRef<AbortController | null>(null);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    if (!v) {
      // No reseteamos query al cerrar — UX vanguardia: al reabrir el usuario
      // puede continuar donde se quedó. Reset se hace explícito desde el
      // componente cuando se ejecuta un item.
    }
  }, []);

  const toggle = useCallback(() => setOpenState((p) => !p), []);

  const reset = useCallback(() => {
    setQueryState("");
    setSelectedIndex(0);
  }, []);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    setSelectedIndex(0); // Reinicia selección al teclear.
  }, []);

  /* ---------- Listener global ⌘P / Ctrl+P ---------- */

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // ⌘P (Mac) / Ctrl+P (Win/Linux). preventDefault para sobrescribir el
      // print dialog del navegador. ⌘K queda libre para ARIA Copilot.
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setOpenState((p) => !p);
        return;
      }
      // Esc cierra (también lo maneja el componente para focus trap, pero
      // duplicar aquí es barato y evita carreras si el componente se monta
      // antes del trap).
      if (e.key === "Escape" && open) {
        setOpenState(false);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  /* ---------- Fetch one-shot: cotizaciones recientes ---------- */

  useEffect(() => {
    if (!open) return;
    // Solo fetch si no las tenemos ya cacheadas.
    if (recientes.length > 0) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/cotizaciones?limit=${RECENT_LIMIT}&offset=0`,
          { signal: ctrl.signal, cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as CotizacionesApiResponse;
        if (Array.isArray(data.cotizaciones)) {
          setRecientes(data.cotizaciones.slice(0, RECENT_LIMIT));
        }
      } catch {
        // Silencio — el palette sigue siendo útil sin recientes.
      }
    })();
    return () => ctrl.abort();
  }, [open, recientes.length]);

  /* ---------- Fetch debounced: clientes + catálogo según query ---------- */

  useEffect(() => {
    if (!open) return;

    // Cancelar request anterior si existe.
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const normQ = normalize(query);

    // Sin query: cargar lista corta de clientes (todos, no filtrados) y
    // dejar catálogo vacío para no saturar el modal.
    if (!normQ) {
      (async () => {
        try {
          setLoadingRemote(true);
          const res = await fetch(`/api/clientes`, {
            signal: ctrl.signal,
            cache: "no-store",
          });
          if (res.ok) {
            const data = (await res.json()) as ClientesApiResponse;
            if (Array.isArray(data.clientes)) {
              setClientes(data.clientes.slice(0, REMOTE_LIMIT));
            }
          }
          setEquipos([]);
          setPlanes([]);
        } catch {
          // ignore
        } finally {
          if (!ctrl.signal.aborted) setLoadingRemote(false);
        }
      })();
      return () => ctrl.abort();
    }

    // Con query: debounce 200ms, luego fetch paralelo de los 3 endpoints.
    const t = setTimeout(async () => {
      setLoadingRemote(true);
      try {
        const [cliRes, eqRes, plRes] = await Promise.allSettled([
          fetch(`/api/clientes`, { signal: ctrl.signal, cache: "no-store" }),
          fetch(
            `/api/catalogos/equipos?q=${encodeURIComponent(query)}`,
            { signal: ctrl.signal, cache: "no-store" },
          ),
          fetch(`/api/catalogos/planes`, {
            signal: ctrl.signal,
            cache: "no-store",
          }),
        ]);

        if (cliRes.status === "fulfilled" && cliRes.value.ok) {
          const data = (await cliRes.value.json()) as ClientesApiResponse;
          if (Array.isArray(data.clientes)) {
            setClientes(data.clientes);
          }
        }
        if (eqRes.status === "fulfilled" && eqRes.value.ok) {
          const data = (await eqRes.value.json()) as EquiposApiResponse;
          if (Array.isArray(data.equipos)) {
            setEquipos(data.equipos.slice(0, REMOTE_LIMIT));
          }
        }
        if (plRes.status === "fulfilled" && plRes.value.ok) {
          const data = (await plRes.value.json()) as PlanesApiResponse;
          if (Array.isArray(data.planes)) {
            setPlanes(data.planes.slice(0, REMOTE_LIMIT));
          }
        }
      } catch {
        // ignore
      } finally {
        if (!ctrl.signal.aborted) setLoadingRemote(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [open, query]);

  /* ---------- Build de items ---------- */

  const acciones = useMemo<PaletteItem[]>(
    () => [
      {
        id: "acc:nueva-cotizacion",
        section: "acciones",
        label: "Nueva cotización",
        meta: "Wizard interactivo",
        hint: "Enter",
        icon: "plus",
        searchText: normalize("nueva cotizacion crear quote new"),
        onSelect: () => navigate("/dashboard/cotizar"),
      },
      {
        id: "acc:subir-excel",
        section: "acciones",
        label: "Subir Excel",
        meta: "Cotización masiva desde archivo",
        hint: "Enter",
        icon: "upload",
        searchText: normalize("subir excel xlsx archivo masivo importar"),
        onSelect: () => navigate("/dashboard/cotizar-excel"),
      },
      {
        id: "acc:optimizar",
        section: "acciones",
        label: "Optimizar palancas",
        meta: "Mejorar margen de una cotización",
        hint: "Enter",
        icon: "trendingUp",
        searchText: normalize("optimizar palancas margen mejorar"),
        onSelect: () => navigate("/dashboard/optimizar"),
      },
      {
        id: "acc:configuracion",
        section: "acciones",
        label: "Configuración",
        meta: "Cuenta, credenciales Telcel, perfil",
        hint: "Enter",
        icon: "settings",
        searchText: normalize("configuracion settings perfil cuenta credenciales"),
        onSelect: () => navigate("/dashboard/configuracion"),
      },
      {
        id: "acc:logout",
        section: "acciones",
        label: "Cerrar sesión",
        meta: "Salir de la cuenta",
        hint: "Enter",
        icon: "logOut",
        searchText: normalize("cerrar sesion logout salir signout exit"),
        onSelect: onLogout,
      },
    ],
    [navigate, onLogout],
  );

  const paginas = useMemo<PaletteItem[]>(
    () => [
      {
        id: "pag:inicio",
        section: "paginas",
        label: "Inicio",
        meta: "/dashboard",
        icon: "home",
        searchText: normalize("inicio home dashboard"),
        onSelect: () => navigate("/dashboard"),
      },
      {
        id: "pag:cotizar",
        section: "paginas",
        label: "Cotizar",
        meta: "/dashboard/cotizar",
        icon: "plus",
        searchText: normalize("cotizar nueva quote"),
        onSelect: () => navigate("/dashboard/cotizar"),
      },
      {
        id: "pag:cotizar-excel",
        section: "paginas",
        label: "Cotizar desde Excel",
        meta: "/dashboard/cotizar-excel",
        icon: "upload",
        searchText: normalize("cotizar excel masivo archivo"),
        onSelect: () => navigate("/dashboard/cotizar-excel"),
      },
      {
        id: "pag:optimizar",
        section: "paginas",
        label: "Optimizar",
        meta: "/dashboard/optimizar",
        icon: "trendingUp",
        searchText: normalize("optimizar palancas margen"),
        onSelect: () => navigate("/dashboard/optimizar"),
      },
      {
        id: "pag:historial",
        section: "paginas",
        label: "Historial",
        meta: "/dashboard/historial",
        icon: "history",
        searchText: normalize("historial cotizaciones pasadas"),
        onSelect: () => navigate("/dashboard/historial"),
      },
      {
        id: "pag:clientes",
        section: "paginas",
        label: "Clientes",
        meta: "/dashboard/clientes",
        icon: "users",
        searchText: normalize("clientes cartera"),
        onSelect: () => navigate("/dashboard/clientes"),
      },
      {
        id: "pag:catalogos",
        section: "paginas",
        label: "Catálogos",
        meta: "/dashboard/catalogos",
        icon: "package",
        searchText: normalize("catalogos equipos planes precios"),
        onSelect: () => navigate("/dashboard/catalogos"),
      },
      {
        id: "pag:configuracion",
        section: "paginas",
        label: "Configuración",
        meta: "/dashboard/configuracion",
        icon: "settings",
        searchText: normalize("configuracion ajustes settings"),
        onSelect: () => navigate("/dashboard/configuracion"),
      },
    ],
    [navigate],
  );

  const clienteItems = useMemo<PaletteItem[]>(
    () =>
      clientes.slice(0, REMOTE_LIMIT).map((c) => {
        const nombre = c.nombre || c.razon_social || c.rfc;
        return {
          id: `cli:${c.rfc}`,
          section: "clientes",
          label: nombre,
          meta: c.rfc,
          icon: "user",
          searchText: normalize(`${nombre} ${c.rfc}`),
          onSelect: () =>
            navigate(`/dashboard/cliente/${encodeURIComponent(c.rfc)}`),
        } as PaletteItem;
      }),
    [clientes, navigate],
  );

  const cotizacionItems = useMemo<PaletteItem[]>(
    () =>
      recientes.slice(0, RECENT_LIMIT).map((c) => {
        const folio = fmtFolio(c);
        const fecha = fmtFecha(c.created_at);
        const equipo = c.equipo || c.plan_global || "—";
        return {
          id: `cot:${c.id}`,
          section: "cotizaciones",
          label: `${folio} · ${equipo}`,
          meta:
            (c.rfc ? `${c.rfc} · ` : "") +
            `${c.lineas} línea${c.lineas === 1 ? "" : "s"} · ${c.estado}`,
          hint: fecha,
          icon: "fileText",
          searchText: normalize(
            `${folio} ${c.rfc || ""} ${equipo} ${c.estado} ${c.plan_global || ""}`,
          ),
          onSelect: () =>
            navigate(`/dashboard/historial?folio=${encodeURIComponent(c.id)}`),
        } as PaletteItem;
      }),
    [recientes, navigate],
  );

  const catalogoItems = useMemo<PaletteItem[]>(() => {
    if (!query.trim()) return []; // Sin query no mostramos catálogo (ruidoso).
    const eqItems: PaletteItem[] = equipos.slice(0, REMOTE_LIMIT).map((e) => ({
      id: `eq:${e.marca}:${e.modelo}`,
      section: "catalogo",
      label: `${e.marca} ${e.modelo}`,
      meta: "Equipo",
      icon: "package",
      searchText: normalize(`${e.marca} ${e.modelo} equipo`),
      onSelect: () =>
        navigate(
          `/dashboard/catalogos?marca=${encodeURIComponent(e.marca)}&q=${encodeURIComponent(e.modelo)}`,
        ),
    }));
    const plItems: PaletteItem[] = planes.slice(0, REMOTE_LIMIT).map((p) => {
      const label = p.nombre || p.clave || "Plan";
      const renta =
        typeof p.renta === "number"
          ? `$${p.renta.toLocaleString("es-MX")}`
          : "";
      const plazo = typeof p.plazo === "number" ? `${p.plazo} meses` : "";
      const meta = [p.grupo, p.modalidad, renta, plazo]
        .filter(Boolean)
        .join(" · ");
      return {
        id: `pl:${p.clave || label}`,
        section: "catalogo",
        label,
        meta: meta || "Plan",
        icon: "package",
        searchText: normalize(
          `${label} ${p.clave || ""} ${p.grupo || ""} ${p.modalidad || ""}`,
        ),
        onSelect: () => navigate("/dashboard/catalogos"),
      };
    });
    return [...eqItems, ...plItems];
  }, [equipos, planes, query, navigate]);

  /* ---------- Filtrado + flat list ---------- */

  const groups = useMemo(() => {
    const normQ = normalize(query);
    const bySection: Record<PaletteSection, PaletteItem[]> = {
      acciones: acciones.filter((i) => matchesQuery(i, normQ)),
      paginas: paginas.filter((i) => matchesQuery(i, normQ)),
      // Clientes / cotizaciones / catalogo ya vienen del backend filtrados
      // cuando hay query; aplicamos un filtro local extra por consistencia.
      clientes: clienteItems.filter((i) => matchesQuery(i, normQ)),
      cotizaciones: cotizacionItems.filter((i) => matchesQuery(i, normQ)),
      catalogo: catalogoItems.filter((i) => matchesQuery(i, normQ)),
    };
    return SECTION_ORDER.filter((s) => bySection[s].length > 0).map((s) => ({
      section: s,
      title: SECTION_TITLES[s],
      items: bySection[s],
    }));
  }, [acciones, paginas, clienteItems, cotizacionItems, catalogoItems, query]);

  const items = useMemo<PaletteItem[]>(
    () => groups.flatMap((g) => g.items),
    [groups],
  );

  // Clamp del selectedIndex si la lista se encoge debajo del cursor.
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  const runSelected = useCallback(() => {
    const it = items[selectedIndex];
    if (!it) return;
    it.onSelect();
  }, [items, selectedIndex]);

  return {
    open,
    setOpen,
    toggle,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    items,
    groups,
    loadingRemote,
    runSelected,
    reset,
  };
}
