/**
 * myLinksApi.ts — Tipado y helpers del cliente para la sección "Mis Links"
 * (G-1 Lead Capture).
 *
 * Endpoints consumidos (todos via Next.js proxy en /api/mis-links):
 *   GET  /api/mis-links          → lista de links del tenant
 *   POST /api/mis-links/create   → crear un link nuevo
 *
 * El backend real es cmdemobot.fly.dev/api/v1/public-link/*.
 * Las llamadas autenticadas van SIEMPRE a través del proxy Next.js
 * (nunca directo desde el cliente al bot).
 */

export interface PublicLink {
  /** Slug base32 de 8 chars. Ej: "A3BK7Q2R" */
  slug: string;
  /** URL pública completa. Ej: "https://cotizador.hectoria.mx/p/A3BK7Q2R" */
  public_url: string;
  /** ISO-8601 timestamp de creación */
  created_at: string;
  /** ISO-8601 timestamp de expiración */
  expires_at: string;
  /** Máximo de usos permitidos */
  max_uses: number;
  /** Usos actuales */
  uses_count: number;
  /** Email del cliente asignado (opcional) */
  cliente_email?: string | null;
  /** Palancas por defecto del vendedor */
  palancas_default?: Record<string, unknown>;
}

export type LinkStatus = "activo" | "expirado" | "agotado";

/**
 * Determina el estado de un link a partir de sus datos.
 * "agotado" tiene precedencia sobre "expirado" para que el vendor
 * sepa que el uso se completó aunque no haya expirado por tiempo.
 */
export function getLinkStatus(link: PublicLink): LinkStatus {
  if (link.uses_count >= link.max_uses) return "agotado";
  if (new Date(link.expires_at) < new Date()) return "expirado";
  return "activo";
}

/* ---------- Llamadas al proxy Next.js ---------- */

export interface ListLinksResponse {
  links: PublicLink[];
  total: number;
}

export async function listLinks(page = 1): Promise<ListLinksResponse> {
  const res = await fetch(`/api/mis-links?page=${page}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<ListLinksResponse>;
}

export interface CreateLinkParams {
  max_uses?: number;
  expires_in_days?: number;
  cliente_email?: string;
  palancas_default?: Record<string, unknown>;
}

export interface CreateLinkResponse {
  slug: string;
  public_url: string;
  expires_at: string;
}

export async function createLink(
  params: CreateLinkParams
): Promise<CreateLinkResponse> {
  const res = await fetch("/api/mis-links/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
  }
  return body as CreateLinkResponse;
}
