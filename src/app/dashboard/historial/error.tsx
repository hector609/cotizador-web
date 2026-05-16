'use client';

/**
 * error.tsx — Error boundary del segmento /dashboard/historial.
 *
 * Next.js 16 breaking change: el prop de recuperación se llama `unstable_retry`
 * (en lugar de `reset` de versiones anteriores). `unstable_retry` re-fetches y
 * re-renderiza el segmento; `reset` solo limpia el error state sin re-fetch.
 * Usar `unstable_retry` para datos del historial (queremos datos frescos al reintentar).
 *
 * SEGURIDAD: NO mostrar `error.message` raw al usuario — en producción los
 * errores de Server Components ya vienen sanitizados por Next.js, pero por
 * consistencia y defensa en profundidad, siempre mostramos mensaje genérico.
 * El `error.digest` se envía a /api/centinela/report-error para correlacionar
 * con los logs server-side.
 */

import { useEffect } from 'react';

export default function HistorialError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Reportar a Centinela — solo digest + mensaje truncado, nunca stack (puede tener PII)
    fetch('/api/centinela/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'dashboard-historial',
        digest: error.digest,
        message: error.message?.slice(0, 500),
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
      <h2 className="text-xl font-semibold text-rose-200">
        Algo no funcionó en esta sección
      </h2>
      <p className="mt-2 text-sm text-rose-300/80">
        Reportamos el error automáticamente. Puedes reintentar o volver al dashboard.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={unstable_retry}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-600 transition-colors"
        >
          Reintentar
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-800/50 transition-colors"
        >
          Ir al dashboard
        </a>
      </div>
    </div>
  );
}
