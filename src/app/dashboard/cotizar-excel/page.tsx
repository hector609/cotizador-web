"use client";

/**
 * /dashboard/cotizar-excel — subida de plantilla Excel multi-perfil.
 *
 * Es la única vía pre-chat que sobrevive del Wizard antiguo: el vendedor
 * descarga la plantilla (`/api/excel/plantilla`), la llena off-line con N
 * perfiles, la sube aquí, y el backend la procesa (POST
 * /api/cotizaciones/excel → polling igual que el chat).
 *
 * Se mantiene como página independiente —y no como modo del chat— porque
 *  1) el flow es 100% no-conversacional (arrastra + sube),
 *  2) nos permite medir telemetría limpia "cotizacion_iniciada source=excel"
 *     vs source=chat, que es la decisión que el owner quiere validar antes
 *     de matar permanentemente esta opción.
 *
 * Antes este componente vivía dentro de `cotizar-old/page.tsx` como
 * `ExcelUploadMode`. Al borrar el wizard legacy extrajimos solo lo necesario:
 *   - state local (file, error, isDragging, submit)
 *   - polling propio contra GET /api/cotizaciones/{id}
 *   - link a `/api/excel/plantilla` para descargar la plantilla
 *
 * Auth: la página es Client Component; el wrapper /api/cotizaciones/excel
 * valida la cookie de sesión. Si vence, redirigimos a /login.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CrearCotizacionResponse } from "@/types/cotizacion";

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "polling"; id: string }
  | { kind: "success"; pdfUrl?: string; id: string }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000;

/**
 * Fire-and-forget para telemetría. NUNCA bloquea el flow ni propaga
 * errores hacia el usuario — si Vercel logs se cae, el cotizar sigue.
 */
function fireTelemetry(source: "excel"): void {
  try {
    void fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "cotizacion_iniciada",
        source,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }).catch(() => {
      // Silencio total: telemetría nunca rompe UX.
    });
  } catch {
    // Algunos navegadores antiguos podrían tirar sync; tampoco propagamos.
  }
}

export default function CotizarExcelPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  // Polling refs (ver patrón en useChatCotizar): refs en lugar de state para
  // que cambiar el handle no dispare re-render.
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }

  // Cleanup al desmontar: si el usuario navega fuera mientras polleamos, abortar.
  useEffect(() => {
    return () => clearPolling();
  }, []);

  const isBusy = submit.kind === "loading" || submit.kind === "polling";

  function pickFile(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const fname = f.name.toLowerCase();
    if (!fname.endsWith(".xlsx") && !fname.endsWith(".xlsm")) {
      setError("El archivo debe ser .xlsx o .xlsm.");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setError("Archivo muy grande (>2MB).");
      return;
    }
    setFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (isBusy) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) pickFile(f);
  }

  function startPolling(id: string) {
    clearPolling();
    setSubmit({ kind: "polling", id });

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/cotizaciones/${encodeURIComponent(id)}`,
          { method: "GET", cache: "no-store" },
        );
        if (res.status === 401) {
          clearPolling();
          router.push("/login?next=/dashboard/cotizar-excel");
          return;
        }
        if (!res.ok) {
          // Errores transitorios — el siguiente tick reintenta. El timeout
          // de 5 min corta si el upstream nunca recupera.
          return;
        }
        const data = (await res.json()) as CrearCotizacionResponse;
        const cot = data.cotizacion;
        if (!cot) return;
        if (cot.estado === "completada") {
          clearPolling();
          setSubmit({ kind: "success", id: cot.id, pdfUrl: cot.pdf_url });
        } else if (cot.estado === "fallida") {
          clearPolling();
          setSubmit({
            kind: "error",
            message:
              cot.error || "La cotización falló en el portal del operador.",
          });
        }
        // pendiente → seguimos esperando.
      } catch {
        // Errores de red transitorios.
      }
    };

    pollIntervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
    pollTimeoutRef.current = setTimeout(() => {
      clearPolling();
      setSubmit({
        kind: "error",
        message:
          "La cotización está tardando más de lo normal. Revisa el historial en unos minutos o reintenta.",
      });
    }, POLL_TIMEOUT_MS);
  }

  async function handleSubir() {
    if (!file || isBusy) return;
    setError(null);
    setSubmit({ kind: "loading" });

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/cotizaciones/excel", {
        method: "POST",
        body: fd,
      });

      if (res.status === 401) {
        window.location.href = "/login?next=/dashboard/cotizar-excel";
        return;
      }

      if (!res.ok) {
        let message = "No pudimos procesar el Excel.";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        setSubmit({ kind: "error", message });
        return;
      }

      const data = (await res.json()) as CrearCotizacionResponse;
      const cot = data.cotizacion;
      if (!cot?.id) {
        setSubmit({
          kind: "error",
          message: "Respuesta inesperada del servidor. Inténtalo otra vez.",
        });
        return;
      }

      // Fire-and-forget: el upstream aceptó el Excel y arrancó cotización.
      // Lo lanzamos antes del polling para que el evento se registre aunque
      // el polling tarde / falle.
      fireTelemetry("excel");

      if (cot.estado === "completada") {
        setSubmit({ kind: "success", id: cot.id, pdfUrl: cot.pdf_url });
        return;
      }
      if (cot.estado === "fallida") {
        setSubmit({
          kind: "error",
          message:
            cot.error || "La cotización falló en el portal del operador.",
        });
        return;
      }

      startPolling(cot.id);
    } catch {
      setSubmit({
        kind: "error",
        message:
          "Sin conexión con el servidor. Revisa tu red e inténtalo otra vez.",
      });
    }
  }

  function reset() {
    clearPolling();
    setFile(null);
    setError(null);
    setSubmit({ kind: "idle" });
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
            Cotizador — Subir Excel
          </h1>
          <nav className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
              Inicio
            </Link>
            <Link
              href="/dashboard/cotizar"
              className="text-slate-600 hover:text-slate-900"
            >
              Chat
            </Link>
            <Link
              href="/dashboard/historial"
              className="text-slate-600 hover:text-slate-900"
            >
              Historial
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <h2 className="text-lg font-semibold text-slate-900">
            Cotización desde Excel
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Para cotizaciones multi-perfil (varios equipos en el mismo cliente).
            Descarga la plantilla, llénala off-line, y súbela aquí. Soporta hasta
            50 perfiles por cotización.
          </p>

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <a
              href="/api/excel/plantilla"
              download
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition"
            >
              <span aria-hidden="true">↓</span> Descargar plantilla
            </a>
            <span className="text-xs text-slate-500">
              Llena RFC, Nombre, Trámite, Plazo y una fila por perfil.
            </span>
          </div>

          <div
            onDragEnter={(e) => {
              e.preventDefault();
              if (!isBusy) setIsDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => !isBusy && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isBusy) {
                inputRef.current?.click();
              }
            }}
            className={[
              "mt-6 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition",
              isBusy
                ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
                : isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:bg-slate-100",
            ].join(" ")}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={isBusy}
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(file.size / 1024).toFixed(1)} KB ·{" "}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      pickFile(null);
                    }}
                    className="underline hover:text-slate-700 disabled:opacity-50"
                  >
                    Cambiar
                  </button>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Arrastra tu .xlsx aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Solo .xlsx / .xlsm · Máximo 2MB
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {submit.kind === "idle" && (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleSubir}
                disabled={!file}
                className="px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Cotizar Excel
              </button>
            </div>
          )}

          {submit.kind === "loading" && (
            <div className="mt-6">
              <button
                type="button"
                disabled
                className="px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg opacity-70 cursor-wait inline-flex items-center gap-3"
              >
                <span
                  className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                  aria-hidden="true"
                />
                Enviando solicitud…
              </button>
            </div>
          )}

          {submit.kind === "polling" && (
            <div
              className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 w-5 h-5 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-blue-900 font-semibold">
                    Cotizando en Telcel… esto tarda 2-4 min
                  </p>
                  <p className="text-sm text-blue-800 mt-1">
                    Estamos corriendo la cotización contra el portal del operador.
                    Puedes dejar esta pantalla abierta — te avisamos cuando termine.
                  </p>
                  <p className="text-xs text-blue-700 mt-2">
                    Folio: <span className="font-mono">{submit.id}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {submit.kind === "success" && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-emerald-900 font-semibold">Cotización lista.</p>
              <p className="text-sm text-emerald-800 mt-1">
                Folio: <span className="font-mono">{submit.id}</span>
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {submit.pdfUrl && (
                  <a
                    href={submit.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 transition"
                  >
                    Descargar PDF
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
                <Link
                  href="/dashboard/historial"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-emerald-300 text-emerald-800 text-sm font-semibold rounded-lg hover:bg-emerald-100 transition"
                >
                  Ver historial
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 transition"
                >
                  Subir otra
                </button>
              </div>
              {!submit.pdfUrl && (
                <p className="mt-3 text-sm text-emerald-800">
                  El PDF aún se está generando. Revisa el historial en unos segundos.
                </p>
              )}
            </div>
          )}

          {submit.kind === "error" && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="text-red-900 font-semibold">No pudimos cotizar.</p>
              <p className="text-sm text-red-800 mt-1">{submit.message}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-4 px-4 py-2 bg-red-700 text-white text-sm font-semibold rounded-lg hover:bg-red-800 transition"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
