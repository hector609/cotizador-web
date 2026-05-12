import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

/**
 * POST /api/telemetry/event — telemetría mínima (chat vs Excel).
 *
 * Owner quiere validar la hipótesis "el chat reemplaza al Wizard" midiendo
 * cuántas cotizaciones se inician por cada canal (chat conversacional vs
 * subida de Excel). No queremos sumar Mixpanel/PostHog todavía — basta con
 * loggear un JSON estructurado y leerlo desde Vercel logs.
 *
 * Contrato (intencionalmente flojo):
 *   Request:  { type: "cotizacion_iniciada", source: "chat" | "excel",
 *               timestamp?: string, extra?: object }
 *   Response: 204 si se aceptó; 400 si el shape no es válido.
 *
 * No bloqueante: el cliente lo invoca fire-and-forget, así que aquí solo
 * validamos lo mínimo y respondemos rápido. El `user_email` no se reenvía
 * desde el cliente — lo derivamos del cookie de sesión (vendedor_id /
 * distribuidor_id) para evitar suplantación.
 *
 * Si no hay sesión válida aceptamos el evento igual (status=anon) — algunos
 * flows pre-login podrían querer reportar visitas, y bloquear con 401 solo
 * generaría ruido en logs sin ganar nada.
 */

const ALLOWED_SOURCES = new Set(["chat", "excel"]);
const ALLOWED_TYPES = new Set(["cotizacion_iniciada"]);
const MAX_EXTRA_KEYS = 8;
const MAX_STRING_LEN = 200;

interface TelemetryBody {
  type?: unknown;
  source?: unknown;
  timestamp?: unknown;
  extra?: unknown;
}

function sanitizeExtra(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string | number | boolean> = {};
  let kept = 0;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (kept >= MAX_EXTRA_KEYS) break;
    if (typeof k !== "string" || k.length > 64) continue;
    if (typeof v === "string") {
      out[k] = v.slice(0, MAX_STRING_LEN);
      kept++;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
      kept++;
    } else if (typeof v === "boolean") {
      out[k] = v;
      kept++;
    }
  }
  return kept > 0 ? out : undefined;
}

export async function POST(request: Request) {
  let body: TelemetryBody;
  try {
    body = (await request.json()) as TelemetryBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type : "";
  const source = typeof body.source === "string" ? body.source : "";
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "type inválido" }, { status: 400 });
  }
  if (!ALLOWED_SOURCES.has(source)) {
    return NextResponse.json({ error: "source inválido" }, { status: 400 });
  }

  // Timestamp del cliente es opcional — si viene como string ISO razonable
  // lo aceptamos; si no, usamos el server-side.
  let clientTs: string | undefined;
  if (typeof body.timestamp === "string" && body.timestamp.length <= 40) {
    const t = Date.parse(body.timestamp);
    if (Number.isFinite(t)) clientTs = new Date(t).toISOString();
  }

  const session = getSessionFromRequest(request);
  const extra = sanitizeExtra(body.extra);

  // Log estructurado JSON en una sola línea — Vercel lo captura en
  // Functions logs y puede filtrarse con `type:telemetry`.
  console.log(
    JSON.stringify({
      type: "telemetry",
      event: type,
      source,
      vendedor_id: session?.vendedor_id ?? null,
      distribuidor_id: session?.distribuidor_id ?? null,
      timestamp: clientTs || new Date().toISOString(),
      server_ts: new Date().toISOString(),
      ...(extra ? { extra } : {}),
    }),
  );

  return new NextResponse(null, { status: 204 });
}
