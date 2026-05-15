"use client";

/**
 * error.tsx — Error boundary global (Next.js App Router).
 * Captura errores client-side, muestra UI empática, reporta al backend.
 */

import { useEffect } from "react";
import { reportError } from "@/lib/centinela-report";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    reportError({
      error_message: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Algo salió mal
        </h1>
        <p className="text-gray-600 mb-6">
          Ya estamos viendo el problema. Te avisaremos cuando se resuelva.
        </p>
        <p className="text-sm text-gray-500 mb-6 break-words">
          {error.message || "error desconocido"}
        </p>
        <button
          onClick={reset}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
