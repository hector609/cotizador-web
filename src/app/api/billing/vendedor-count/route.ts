/**
 * GET /api/billing/vendedor-count
 *
 * Devuelve el count de tenants con plan vendedor_telcel activos.
 * Usado por /precios y /vendedor-telcel para mostrar "X/100 cupos disponibles".
 *
 * Consulta el bot API. Si el bot no está disponible, devuelve count: 0
 * (mejor mostrar cupos disponibles que romper la página de precios).
 *
 * Response: { count: number }
 */

import { NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

export const revalidate = 300; // Cache 5 min (no necesitamos conteo en tiempo real)

export async function GET() {
  try {
    if (!BOT_API_URL || !WEBHOOK_SECRET) {
      return NextResponse.json({ count: 0 });
    }

    const resp = await fetch(`${BOT_API_URL}/api/v1/admin/tenants?plan=vendedor_telcel`, {
      headers: { "X-Webhook-Secret": WEBHOOK_SECRET },
      next: { revalidate: 300 },
    });

    if (!resp.ok) {
      return NextResponse.json({ count: 0 });
    }

    const data = (await resp.json()) as { tenants?: unknown[] } | unknown[] | null;
    let count = 0;
    if (Array.isArray(data)) {
      count = data.length;
    } else if (data && typeof data === "object" && "tenants" in data && Array.isArray((data as { tenants: unknown[] }).tenants)) {
      count = (data as { tenants: unknown[] }).tenants.length;
    }

    return NextResponse.json({ count });
  } catch {
    // Best-effort: nunca romper la página de precios por esto
    return NextResponse.json({ count: 0 });
  }
}
