"use client";

/**
 * /dashboard/cotizar-excel — subida de plantilla Excel multi-perfil.
 *
 * REDISEÑO LUMINA Light Premium (pivot 2026-05-13). Antes usaba `DashboardNav`
 * legacy + botones `bg-blue-700` saturados; ahora consume el `Sidebar`
 * compartido, surfaces `bg-white rounded-2xl shadow-sm`, paleta
 * indigo-600/cyan-500/emerald-500/rose-500 y pill buttons gradient
 * indigo→cyan para primary, outline indigo-200 para secondary. Banners
 * progresivos con framer-motion fade-up; el dropzone también anima en hover.
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
import { apiFetch } from "@/lib/api-fetch";
import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCw,
  ExternalLink,
  X,
  Mail,
} from "lucide-react";
import type { CrearCotizacionResponse } from "@/types/cotizacion";
import { Sidebar, type SidebarKey } from "@/components/admin/Sidebar";

/**
 * Fases del banner progresivo. Idéntico al patrón en useChatCotizar —
 * la idea es que el vendedor reciba el mismo lenguaje y los mismos
 * umbrales sin importar si subió Excel o si chateó.
 */
type PollingStage = "normal" | "slow" | "very_slow" | "warning";

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "polling";
      id: string;
      startedAt: number;
      elapsedMs: number;
      stage: PollingStage;
    }
  | { kind: "success"; pdfUrl?: string; id: string }
  | { kind: "error"; message: string; timedOut?: boolean; id?: string };

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000;
const STAGE_TICK_MS = 1_000;
const STAGE_THRESHOLDS = {
  slow: 30_000,
  verySlow: 90_000,
  warning: 180_000,
} as const;

function stageFromElapsed(elapsedMs: number): PollingStage {
  if (elapsedMs >= STAGE_THRESHOLDS.warning) return "warning";
  if (elapsedMs >= STAGE_THRESHOLDS.verySlow) return "very_slow";
  if (elapsedMs >= STAGE_THRESHOLDS.slow) return "slow";
  return "normal";
}

const STAGE_COPY: Record<
  PollingStage,
  { title: string; body: string; tone: "info" | "warn" }
> = {
  normal: {
    title: "Tu cotización está en marcha",
    body: "Telcel suele tardar 1-4 minutos. Puedes dejar esta pestaña abierta.",
    tone: "info",
  },
  slow: {
    title: "Trabajando con Telcel…",
    body: "Estamos verificando el plan y el equipo en el portal del operador.",
    tone: "info",
  },
  very_slow: {
    title: "Telcel está tardando más de lo normal",
    body: "Sigue corriendo. El portal a veces se pone lento en horas pico.",
    tone: "info",
  },
  warning: {
    title: "Telcel está lento hoy",
    body: "Vamos a esperar máximo 5 min. Puedes seguir trabajando en otra pestaña y te avisamos cuando llegue.",
    tone: "warn",
  },
};

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

  const errorId = useId();

  // Polling refs (ver patrón en useChatCotizar): refs en lugar de state para
  // que cambiar el handle no dispare re-render.
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Interval que actualiza `elapsedMs` y `stage` cada 1s para renderizar
   * el banner progresivo. Independiente del polling al backend (5s).
   */
  const stageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (stageIntervalRef.current) {
      clearInterval(stageIntervalRef.current);
      stageIntervalRef.current = null;
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
    const startedAt = Date.now();
    setSubmit({
      kind: "polling",
      id,
      startedAt,
      elapsedMs: 0,
      stage: "normal",
    });

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
            id: cot.id,
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
    // Stage tick: refresca elapsedMs/stage cada 1s para que el banner se
    // mueva entre fases sin esperar el siguiente poll al backend.
    stageIntervalRef.current = setInterval(() => {
      setSubmit((prev) => {
        if (prev.kind !== "polling") return prev;
        const elapsedMs = Date.now() - prev.startedAt;
        const stage = stageFromElapsed(elapsedMs);
        if (stage === prev.stage && elapsedMs - prev.elapsedMs < 1000) {
          return prev;
        }
        return { ...prev, elapsedMs, stage };
      });
    }, STAGE_TICK_MS);
    pollTimeoutRef.current = setTimeout(() => {
      clearPolling();
      setSubmit({
        kind: "error",
        id,
        timedOut: true,
        message:
          "Telcel no respondió en 5 minutos. Su portal puede estar saturado. La cotización podría seguir corriendo — revisa Historial en unos minutos.",
      });
    }, POLL_TIMEOUT_MS);
  }

  /**
   * Cancelación explícita: limpia estado local inmediato (UX no espera
   * red) y dispara DELETE fire-and-forget al backend. Si falla, no
   * notificamos — el usuario ya ve el estado idle.
   */
  function handleCancel() {
    if (submit.kind !== "polling") return;
    const id = submit.id;
    clearPolling();
    setSubmit({ kind: "idle" });
    void fetch(`/api/cotizaciones/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => {
      // Silencio: el job sigue corriendo upstream o no — el usuario lo verá
      // en Historial si llega a completar.
    });
  }

  async function handleSubir() {
    if (!file || isBusy) return;
    setError(null);
    setSubmit({ kind: "loading" });

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await apiFetch("/api/cotizaciones/excel", {
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

  // El Sidebar marca "cotizar-excel" en SECONDARY_LINKS — la prop `active`
  // es tipada como SidebarKey pero el comparador interno usa `===` contra
  // l.key (que es SidebarKey | string), así que el cast es seguro.
  const sidebarActive = "cotizar-excel" as SidebarKey;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar active={sidebarActive} />

      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-10 md:py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <Link
              href="/dashboard"
              className="hover:text-indigo-600 transition"
            >
              Inicio
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              href="/dashboard/cotizar"
              className="hover:text-indigo-600 transition"
            >
              Cotizar
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">Importar Excel</span>
          </div>

          {/* H1 */}
          <motion.header
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-md shadow-indigo-200">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Cotización desde Excel
              </h1>
            </div>
            <p className="text-sm md:text-base text-slate-600 max-w-2xl">
              Para cotizaciones multi-perfil (varios equipos en el mismo
              cliente). Descarga la plantilla, llénala off-line y súbela aquí.
              Soporta hasta{" "}
              <span className="font-semibold text-slate-800">50 perfiles</span>{" "}
              por cotización.
            </p>
          </motion.header>

          {/* Card principal */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 md:p-8"
          >
            {/* Descargar plantilla */}
            <div className="flex items-center gap-3 flex-wrap mb-6">
              <a
                href="/api/excel/plantilla"
                download
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-indigo-200 text-indigo-700 text-sm font-semibold bg-white hover:bg-indigo-50 hover:border-indigo-300 transition"
              >
                <Download className="w-4 h-4" />
                Descargar plantilla
              </a>
              <span className="text-xs text-slate-500">
                Llena RFC, Nombre, Trámite, Plazo y una fila por perfil.
              </span>
            </div>

            {/* Dropzone */}
            <motion.div
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
              aria-disabled={isBusy}
              aria-describedby={error ? errorId : undefined}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !isBusy) {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              whileHover={!isBusy ? { scale: 1.005 } : undefined}
              transition={{ duration: 0.15 }}
              className={[
                "rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
                isBusy
                  ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
                  : isDragging
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-300 bg-slate-50 hover:bg-indigo-50/40 hover:border-indigo-300",
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
                <div className="flex flex-col items-center gap-2">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-white shadow-md shadow-emerald-100">
                    <FileSpreadsheet className="w-6 h-6" />
                  </span>
                  <p className="text-sm font-semibold text-slate-900">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      pickFile(null);
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 underline disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                    Cambiar archivo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600">
                    <Upload className="w-6 h-6" />
                  </span>
                  <p className="text-sm font-semibold text-slate-700">
                    Arrastra tu .xlsx aquí o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-slate-500">
                    Solo .xlsx / .xlsm · Máximo 2MB
                  </p>
                </div>
              )}
            </motion.div>

            {error && (
              <div
                id={errorId}
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Botón cotizar (idle) */}
            {submit.kind === "idle" && (
              <div className="mt-6">
                <motion.button
                  type="button"
                  onClick={handleSubir}
                  disabled={!file}
                  whileHover={file ? { scale: 1.02 } : undefined}
                  whileTap={file ? { scale: 0.98 } : undefined}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <Upload className="w-4 h-4" />
                  Cotizar Excel
                </motion.button>
              </div>
            )}

            {submit.kind === "loading" && (
              <div className="mt-6">
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold opacity-80 cursor-wait shadow-md shadow-indigo-200"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando solicitud…
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {submit.kind === "polling" && (() => {
                const copy = STAGE_COPY[submit.stage];
                const isWarn = copy.tone === "warn";
                const elapsedS = Math.floor(submit.elapsedMs / 1000);
                const mins = Math.floor(elapsedS / 60);
                const secs = elapsedS % 60;
                const pct = Math.min(
                  100,
                  Math.round((submit.elapsedMs / POLL_TIMEOUT_MS) * 100),
                );
                return (
                  <motion.div
                    key="polling"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={[
                      "mt-6 rounded-2xl border p-5",
                      isWarn
                        ? "border-amber-200 bg-amber-50"
                        : "border-indigo-200 bg-indigo-50/60",
                    ].join(" ")}
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={[
                          "mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                          isWarn
                            ? "bg-amber-100 text-amber-700"
                            : "bg-indigo-100 text-indigo-700",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={[
                            "font-bold",
                            isWarn ? "text-amber-900" : "text-indigo-900",
                          ].join(" ")}
                        >
                          {copy.title}
                        </p>
                        <p
                          className={[
                            "text-sm mt-1",
                            isWarn ? "text-amber-800" : "text-indigo-800",
                          ].join(" ")}
                        >
                          {copy.body}
                        </p>
                        <div
                          className={[
                            "mt-3 h-1.5 w-full rounded-full overflow-hidden",
                            isWarn ? "bg-amber-200/70" : "bg-indigo-100",
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          <motion.div
                            initial={false}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={[
                              "h-full",
                              isWarn
                                ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                : "bg-gradient-to-r from-indigo-500 to-cyan-500",
                            ].join(" ")}
                          />
                        </div>
                        <p
                          className={[
                            "text-xs mt-2 tabular-nums",
                            isWarn ? "text-amber-700" : "text-indigo-700",
                          ].join(" ")}
                        >
                          Tiempo: {mins}:{secs.toString().padStart(2, "0")} /
                          5:00
                          {" · Folio "}
                          <span className="font-mono">{submit.id}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-rose-700 px-2.5 py-1.5 rounded-full hover:bg-rose-50 transition self-start"
                        aria-label="Cancelar la cotización en curso"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancelar
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

              {submit.kind === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
                  role="status"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-emerald-900 font-bold">
                        Cotización lista
                      </p>
                      <p className="text-sm text-emerald-800 mt-1">
                        Folio:{" "}
                        <span className="font-mono">{submit.id}</span>
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {submit.pdfUrl && (
                          <motion.a
                            href={submit.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-200 hover:shadow-lg transition"
                          >
                            <Download className="w-4 h-4" />
                            Descargar PDF
                            <ExternalLink className="w-3.5 h-3.5" />
                          </motion.a>
                        )}
                        <Link
                          href="/dashboard/historial"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-emerald-300 text-emerald-800 text-sm font-semibold hover:bg-emerald-100 transition"
                        >
                          Ver historial
                        </Link>
                        <button
                          type="button"
                          onClick={reset}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Subir otra
                        </button>
                      </div>
                      {!submit.pdfUrl && (
                        <p className="mt-3 text-sm text-emerald-800">
                          El PDF aún se está generando. Revisa el historial en
                          unos segundos.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {submit.kind === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5"
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-700 shrink-0">
                      <XCircle className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-rose-900 font-bold">
                        {submit.timedOut
                          ? "Telcel no respondió"
                          : "No pudimos cotizar"}
                      </p>
                      <p className="text-sm text-rose-800 mt-1">
                        {submit.message}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <motion.button
                          type="button"
                          onClick={reset}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 text-white text-sm font-semibold shadow-md shadow-rose-200 hover:shadow-lg transition"
                        >
                          <RotateCw className="w-4 h-4" />
                          Reintentar
                        </motion.button>
                        {submit.timedOut && (
                          <>
                            <Link
                              href="/dashboard/historial"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-rose-300 text-rose-800 text-sm font-semibold hover:bg-rose-100 transition"
                            >
                              Ver historial
                            </Link>
                            <a
                              href={`mailto:soporte@hectoria.mx?subject=${encodeURIComponent(
                                "Telcel timeout — cotización Excel",
                              )}&body=${encodeURIComponent(
                                `Folio: ${submit.id || "?"}\nHora: ${new Date().toLocaleString(
                                  "es-MX",
                                )}\n\nAdjunto contexto:`,
                              )}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Reportar problema
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
