/**
 * api-fetch.ts — wrapper fetch con interceptor global de HTTP 402 (P1-6).
 *
 * Cuando el backend devuelve 402 (suscripción expirada), dispara
 * el evento DOM "subscription:expired" que el modal global captura y muestra
 * al usuario el prompt de renovación.
 */

export async function apiFetch(url: string, opts?: RequestInit): Promise<Response> {
  const res = await fetch(url, opts);

  if (res.status === 402) {
    // Solo disponible en el cliente.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("subscription:expired"));
    }
    throw new Error("subscription_expired");
  }

  return res;
}
