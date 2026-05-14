/**
 * publicLinkApi.ts — Helpers para el flujo de Link Público G-1.
 *
 * Todos los endpoints son PÚBLICOS (sin X-Auth): el cliente final
 * no está autenticado. La autenticación la hizo el VENDEDOR al crear el link.
 *
 * Endpoints en use:
 *  GET  /api/v1/public-link/<slug>              → PublicLinkMeta
 *  POST /api/v1/public-link/<slug>/submit       → SubmitResponse
 *  GET  /api/v1/public-link/<slug>/status?sub=  → StatusResponse
 */

const BOT_API_URL = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PublicLinkMeta {
  valid: boolean;
  vendedor_nombre?: string;
  distribuidor_nombre?: string;
  /** Palancas que el vendedor preconfiguró (plazo, sin_controlado, etc.) */
  palancas_default?: Record<string, unknown>;
  /** ISO-8601 — cuándo expira */
  expires_at?: string;
}

export interface SubmitPayload {
  rfc: string;
  /** Texto libre del equipo (ej. "iPhone 15 Pro Max") */
  equipo_interes?: string;
  lineas: number;
  email_contacto?: string;
  telefono_contacto?: string;
}

export interface SubmitResponse {
  submission_id: string;
  estado: "processing";
}

export type EstadoSubmission = "processing" | "completada" | "fallida";

export interface StatusResponse {
  estado: EstadoSubmission;
  /** Folio Telcel, disponible cuando completada */
  folio?: string;
  /** URL directa al PDF; disponible cuando completada */
  pdf_url?: string;
  /** Monto total MXN */
  monto_total?: number;
  /** Mensaje de error cuando fallida */
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Obtiene los metadatos del link público. Se llama desde Server Component (SSR).
 * Devuelve null si la red falla o el link no existe / expiró.
 */
export async function fetchPublicLinkMeta(
  slug: string,
): Promise<PublicLinkMeta | null> {
  // Slug whitelist: solo base32-ish (28 chars alfanuméricos sin 0/O/1/I), 8 chars.
  if (!/^[A-Z2-9]{6,12}$/i.test(slug)) return null;

  try {
    const res = await fetch(
      `${BOT_API_URL}/api/v1/public-link/${encodeURIComponent(slug)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        // No cache: el link puede expirar entre deploys.
        cache: "no-store",
        // Timeout defensivo: Next.js 15 no expone AbortSignal.timeout en todos
        // los entornos. Usamos el timeout de Next (30 s por default en SSR).
      },
    );

    if (!res.ok) return null;

    const data = (await res.json()) as PublicLinkMeta;
    return data;
  } catch {
    return null;
  }
}

/**
 * Envía el formulario del cliente final al backend.
 * Se llama desde Client Component (browser).
 */
export async function submitPublicLink(
  slug: string,
  payload: SubmitPayload,
): Promise<{ ok: true; data: SubmitResponse } | { ok: false; message: string; status: number }> {
  let res: Response;
  try {
    res = await fetch(
      `/api/public-link/${encodeURIComponent(slug)}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  } catch {
    return { ok: false, status: 0, message: "Sin conexión. Revisa tu internet e intenta otra vez." };
  }

  if (res.status === 429) {
    return { ok: false, status: 429, message: "Demasiados intentos. Espera unos minutos e intenta otra vez." };
  }
  if (res.status === 410) {
    return { ok: false, status: 410, message: "Este link ya alcanzó el límite de usos o expiró." };
  }

  if (res.ok) {
    try {
      const data = (await res.json()) as SubmitResponse;
      return { ok: true, data };
    } catch {
      return { ok: false, status: res.status, message: "Respuesta inválida del servidor." };
    }
  }

  let message = "No pudimos procesar tu solicitud. Intenta de nuevo.";
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === "string" && body.error.length < 300) {
      message = body.error;
    }
  } catch { /* ignorar */ }

  return { ok: false, status: res.status, message };
}

/**
 * Consulta el estado de una submission. Se llama desde Client Component (polling).
 */
export async function pollSubmissionStatus(
  slug: string,
  submissionId: string,
): Promise<StatusResponse | null> {
  try {
    const res = await fetch(
      `/api/public-link/${encodeURIComponent(slug)}/status?sub=${encodeURIComponent(submissionId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as StatusResponse;
  } catch {
    return null;
  }
}

// ── RFC validation ────────────────────────────────────────────────────────────

/**
 * Regex oficial SAT México.
 * PF: 4 letras + 6 dígitos + 3 alfanum = 13 chars
 * PM: 3 letras + 6 dígitos + 3 alfanum = 12 chars
 */
const RFC_PF_RE = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
const RFC_PM_RE = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;

export type RfcTipo = "pf" | "pm" | null;

export function validarRfc(value: string): RfcTipo {
  const v = value.trim().toUpperCase();
  if (RFC_PF_RE.test(v)) return "pf";
  if (RFC_PM_RE.test(v)) return "pm";
  return null;
}
