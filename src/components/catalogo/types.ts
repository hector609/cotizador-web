/**
 * Tipos compartidos para los componentes del catálogo (panel lateral + página
 * /dashboard/catalogos). Reflejan la respuesta de los proxies
 * /api/catalogos/equipos y /api/catalogos/planes — que a su vez son shape del
 * backend del bot (cmdemobot).
 */

export interface EquipoRow {
  marca: string;
  modelo: string;
}

export interface EquiposResponse {
  equipos: EquipoRow[];
  total: number;
  marcas?: string[];
  unavailable?: boolean;
}

export interface PlanRow {
  clave?: string | null;
  nombre?: string | null;
  familia?: string | null;
  grupo?: string | null;
  modalidad?: string | null;
  plazo?: number | null;
  renta?: number | null;
  precio_lista?: number | null;
  datos_gb?: number | null;
  minutos?: number | string | null;
  sms?: number | string | null;
  registro_ift?: string | null;
}

export interface PlanesResponse {
  planes: PlanRow[];
  total: number;
  filtros_disponibles?: {
    grupos?: string[];
    modalidades?: string[];
    plazos?: number[];
  };
  unavailable?: boolean;
}

/* ---------- Formatters compartidos ---------- */

export function fmtMxn(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtPlazo(p: number | null | undefined): string {
  if (typeof p !== "number" || !Number.isFinite(p)) return "—";
  return `${p} meses`;
}

export function fmtMinutos(m: number | string | null | undefined): string {
  if (m === null || m === undefined || m === "") return "—";
  if (typeof m === "string") return m;
  if (m < 0 || m >= 99999) return "Ilimitados";
  return new Intl.NumberFormat("es-MX").format(m);
}

export function fmtDatos(g: number | null | undefined): string {
  if (typeof g !== "number" || !Number.isFinite(g)) return "—";
  if (g >= 9999) return "Ilimitados";
  return `${g} GB`;
}
