/**
 * GET /api/mis-links
 *
 * Proxy autenticado: lista los public-links del tenant.
 * Llama a GET ${BOT_API_URL}/api/v1/public-link?page=<n>
 * firmando con X-Auth v1 (mismo esquema que /api/clientes).
 *
 * Query params:
 *   page  — página (default 1)
 *
 * Plan gating: el backend devuelve 403 si el plan es starter.
 * El proxy lo reenvía al cliente tal cual para que la UI muestre upsell.
 */

import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { signBackendRequest } from "@/lib/backend-auth";

const BOT_API_URL = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";

const errJson = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return errJson("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  let authHeader: { "X-Auth": string };
  try {
    authHeader = signBackendRequest(session.distribuidor_id);
  } catch (e) {
    console.error("[api/mis-links] sign error", e);
    return errJson(
      "Estamos realizando tareas de mantenimiento. Intenta en unos minutos.",
      500
    );
  }

  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "1";

  let upstream: Response;
  try {
    upstream = await fetch(
      `${BOT_API_URL}/api/v1/public-link?page=${page}`,
      {
        method: "GET",
        headers: { ...authHeader, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      }
    );
  } catch (e) {
    console.error("[api/mis-links] backend fetch error", e);
    return errJson("No pudimos cargar tus links. Reintenta en unos segundos.", 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    // 403 puede ser plan gating. Reenviamos para que el cliente detecte.
    return errJson("Sin acceso. Verifica tu plan.", upstream.status);
  }
  if (upstream.status === 404) {
    // Tenant sin links todavía — respuesta válida.
    return NextResponse.json({ links: [], total: 0 }, { status: 200 });
  }
  if (!upstream.ok) {
    console.error("[api/mis-links] upstream error", upstream.status);
    return errJson("Error al cargar links. Reintenta.", 502);
  }

  try {
    const data = await upstream.json();
    // Normalizar: el backend puede devolver { links, total } o { items, count }.
    const links = data.links ?? data.items ?? [];
    const total = data.total ?? data.count ?? links.length;
    return NextResponse.json({ links, total }, { status: 200 });
  } catch {
    return errJson("Respuesta inesperada del servidor.", 502);
  }
}
