/**
 * not-found.tsx — Página 404 global (App Router).
 *
 * Se activa cuando:
 *   a) Se llama `notFound()` desde un RSC o Route Handler.
 *   b) Una URL no coincide con ninguna ruta registrada.
 *
 * Server Component por defecto (no necesita 'use client').
 * Theme: slate/indigo — LUMINA Light Premium, consistente con el dashboard.
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      {/* 404 visual */}
      <div className="mb-6 select-none text-8xl font-black tracking-tight text-indigo-200">
        404
      </div>

      <h1 className="mb-3 text-3xl font-bold text-slate-800">
        Página no encontrada
      </h1>
      <p className="mb-8 max-w-sm text-slate-500">
        La URL que buscas no existe o fue movida. Verifica que no haya un error
        tipográfico en la dirección.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          Volver al inicio
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          Ir al dashboard
        </Link>
      </div>

      <p className="mt-10 text-xs text-slate-400">
        Cotizador Inteligente &mdash; Desarrollado por Hectoria
      </p>
    </div>
  );
}
