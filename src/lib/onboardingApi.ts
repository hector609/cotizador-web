/**
 * onboardingApi.ts — fetch wrappers para el wizard de onboarding.
 *
 * Todos los calls van a través del proxy Next.js (/api/onboarding/*),
 * que firma X-Auth con SESSION_SECRET en el servidor.
 *
 * No se llama directamente al backend (cmdemobot.fly.dev) desde el cliente
 * — el proxy garantiza que el header HMAC sea generado server-side.
 */

export interface OnboardingState {
  user_id: string;
  step: number;
  data: OnboardingData;
  started_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  is_complete: boolean;
}

/** Forma acumulada de todos los campos del wizard. */
export interface OnboardingData {
  // Paso 1 — Distribuidor
  nombre?: string;
  razon_social?: string;
  rfc?: string;
  // Paso 2 — Contacto
  email?: string;
  telefono?: string;
  sitio_web?: string;
  // Paso 3 — Branding
  color_primario?: string;
  color_acento?: string;
  logo_url?: string;
  // Paso 4 — Credenciales Telcel
  telcel_usuario?: string;
  // Paso 5 — Cartera
  clientes?: { nombre: string; rfc: string }[];
  skip_cartera?: boolean;
  // Paso 6 — Vendedores
  vendedores?: { nombre: string; telegram_id: string }[];
  skip_vendedores?: boolean;
  // Paso 7 — Confirmacion
  aceptar_terminos?: boolean;
}

export interface OnboardingStepPayload {
  step: number;
  data: Partial<OnboardingData>;
}

export interface OnboardingStepResponse {
  ok: boolean;
  user_id: string;
  step: number;
  data: OnboardingData;
  started_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  is_complete: boolean;
}

export interface OnboardingCompleteResponse {
  ok: boolean;
  user_id: string;
  step: number;
  completed_at: string;
  dashboard_url: string;
}

export class OnboardingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OnboardingApiError";
  }
}

/** GET /api/onboarding/state */
export async function getOnboardingState(): Promise<OnboardingState> {
  const res = await fetch("/api/onboarding/state", { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new OnboardingApiError(
      (body as { error?: string }).error ?? "Error al cargar el estado del wizard",
      res.status,
    );
  }
  return res.json() as Promise<OnboardingState>;
}

/** POST /api/onboarding/step */
export async function postOnboardingStep(
  payload: OnboardingStepPayload,
): Promise<OnboardingStepResponse> {
  const res = await fetch("/api/onboarding/step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new OnboardingApiError(
      (body as { error?: string }).error ?? "Error al guardar el paso",
      res.status,
    );
  }
  return res.json() as Promise<OnboardingStepResponse>;
}

/** POST /api/onboarding/complete */
export async function postOnboardingComplete(): Promise<OnboardingCompleteResponse> {
  const res = await fetch("/api/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new OnboardingApiError(
      (body as { error?: string }).error ?? "Error al completar el onboarding",
      res.status,
    );
  }
  return res.json() as Promise<OnboardingCompleteResponse>;
}
