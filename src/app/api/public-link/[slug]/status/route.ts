/**
 * GET /api/public-link/[slug]/status?sub=<submission_id>
 *
 * Proxy thin al backend bot para polling del estado de la cotización.
 * No auth required — endpoint público.
 */

import { NextRequest, NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL ?? "https://cmdemobot.fly.dev";

const SLUG_RE = /^[A-Z2-9]{6,12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }

  const submissionId = req.nextUrl.searchParams.get("sub");
  if (!submissionId || !/^[A-Za-z0-9_-]{1,64}$/.test(submissionId)) {
    return NextResponse.json({ error: "sub requerido." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${BOT_API_URL}/api/v1/public-link/${encodeURIComponent(slug)}/status?sub=${encodeURIComponent(submissionId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Backend no disponible." },
      { status: 502 },
    );
  }

  const upstreamBody = await upstream.text();
  return new NextResponse(upstreamBody, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json",
      // No cachear: este endpoint se usa para polling activo.
      "Cache-Control": "no-store",
    },
  });
}
