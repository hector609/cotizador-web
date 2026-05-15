"use client";

/**
 * global-error.tsx — Error boundary root layout (Next.js App Router).
 * Captura errores en el root layout, muestra UI mínima.
 */

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Report al backend (cliente-side best-effort)
    if (typeof window !== "undefined") {
      fetch("/api/centinela/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "web",
          route: window.location.pathname,
          error_message: error.message || "root error",
          stack: error.stack,
          digest: error.digest,
        }),
        keepalive: true,
      }).catch(() => {
        /* best-effort */
      });
    }
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Error crítico
            </h1>
            <p className="text-gray-600 mb-6">
              La aplicación necesita reiniciarse.
            </p>
            <button
              onClick={reset}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded"
            >
              Recargar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
