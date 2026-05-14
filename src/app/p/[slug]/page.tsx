/**
 * /p/[slug] — Página pública de Link de Captura G-1.
 *
 * Server Component: hace SSR fetch del link metadata (validación de existencia
 * y expiración antes de mostrar el form). Sin login, sin tracking opaco.
 *
 * Si el link no existe / expiró → pantalla de error amigable.
 * Si el link es válido → muestra el form + polling client-side.
 *
 * LUMINA Light Premium: indigo #4F46E5 / cyan #06B6D4 / pink #EC4899.
 * Mobile-first: el cliente final probablemente abre en celular via WhatsApp.
 */

import type { Metadata } from "next";
import { fetchPublicLinkMeta } from "@/lib/publicLinkApi";
import { PublicLinkForm } from "@/components/publicLink/PublicLinkForm";

// ── Metadata dinámica para SEO + WhatsApp preview ────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = await fetchPublicLinkMeta(slug);

  if (!meta?.valid) {
    return {
      title: "Propuesta no disponible — Cotizador Telcel",
      description: "Este link de propuesta ya no está disponible.",
      robots: { index: false, follow: false },
    };
  }

  const vendedor = meta.vendedor_nombre ?? "tu vendedor Telcel";
  const distribuidor = meta.distribuidor_nombre;

  return {
    title: `Propuesta Telcel Empresas — ${vendedor}`,
    description: distribuidor
      ? `Solicita tu cotización personalizada Telcel de ${distribuidor}. Sin registro — solo llena el form.`
      : `Solicita tu cotización personalizada Telcel de ${vendedor}. Sin registro — solo llena el form.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `Propuesta Telcel Empresas — ${vendedor}`,
      description: "30 segundos para recibir tu cotización oficial en PDF.",
      type: "website",
      locale: "es_MX",
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PublicLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = await fetchPublicLinkMeta(slug);

  // Link inválido, expirado o no encontrado
  if (!meta || !meta.valid) {
    return <LinkNoDisponible />;
  }

  // Verificar expiración por fecha
  if (meta.expires_at) {
    const expiresAt = new Date(meta.expires_at);
    if (!isNaN(expiresAt.getTime()) && expiresAt < new Date()) {
      return <LinkNoDisponible />;
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900 antialiased">
      {/* Decorative background blobs — puramente decorativo, no afecta legibilidad */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-3xl bg-indigo-200/30 mix-blend-multiply" />
        <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] rounded-full blur-3xl bg-cyan-200/25 mix-blend-multiply" />
        <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] rounded-full blur-3xl bg-pink-200/20 mix-blend-multiply" />
      </div>

      <div className="relative max-w-lg mx-auto px-5 pt-10 pb-20 sm:pt-14">
        {/* Logotipo y branding minimal */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-lg tracking-tight text-slate-900">
              Cotizador
            </span>
            <span className="text-slate-300 select-none">·</span>
            <span className="font-semibold text-sm text-indigo-600">Telcel</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-cyan-50 border border-indigo-200/60 text-indigo-700 text-[10px] font-bold uppercase tracking-widest shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Propuesta
          </span>
        </header>

        {/* Hero card */}
        <section
          aria-labelledby="hero-heading"
          className="mb-8 rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-indigo-100/40 overflow-hidden"
        >
          {/* Gradient strip top */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-pink-400" />

          <div className="px-7 pt-7 pb-6 space-y-2">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {meta.vendedor_nombre && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[11px] font-semibold">
                  {meta.vendedor_nombre}
                </span>
              )}
              {meta.distribuidor_nombre && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-slate-600 text-[11px] font-semibold">
                  {meta.distribuidor_nombre}
                </span>
              )}
              {meta.expires_at && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/60 text-amber-700 text-[11px] font-semibold">
                  Válida hasta {formatDate(meta.expires_at)}
                </span>
              )}
            </div>

            <h1
              id="hero-heading"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-snug"
            >
              Propuesta Telcel Empresas
            </h1>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
              Llene sus datos en 30 segundos y reciba la cotización oficial con
              desglose de planes, equipos y condiciones directamente a su email.
            </p>
          </div>

          {/* Separador */}
          <div className="border-t border-slate-100 mx-7" />

          {/* Form */}
          <div className="px-7 py-7">
            <PublicLinkForm slug={slug} meta={meta} />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center space-y-2">
          <p className="text-xs text-slate-400 leading-relaxed">
            Sus datos solo se usan para generar esta cotización.
            <br />
            No requiere cuenta. Protegido por LFPDPPP.
          </p>
          <p className="text-[11px] text-slate-300 font-medium">
            Powered by Hectoria · Cotizador Inteligente Telcel
          </p>
        </footer>
      </div>
    </main>
  );
}

// ── Link no disponible ───────────────────────────────────────────────────────

function LinkNoDisponible() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-5 antialiased">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icono */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-100 border border-slate-200 text-slate-400 mx-auto">
          <LinkOffIcon />
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Link no disponible
          </h1>
          <p className="text-base text-slate-500 leading-relaxed">
            Este link de propuesta ya no está activo — puede haber expirado o
            haber alcanzado el límite de usos.
          </p>
          <p className="text-sm text-slate-400">
            Contacta a quien te lo envió para solicitar uno nuevo.
          </p>
        </div>

        {/* Branding sutil */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-300 font-medium">
            Cotizador Inteligente Telcel · Powered by Hectoria
          </p>
        </div>
      </div>
    </main>
  );
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function LinkOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-10 h-10"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
