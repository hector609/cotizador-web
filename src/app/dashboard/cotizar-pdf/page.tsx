"use client";

/**
 * /dashboard/cotizar-pdf — Re-cotizar desde PDF de cotización Telcel existente.
 *
 * El vendedor sube un PDF de una cotización anterior (FormatoCliente o
 * FormatoInterno generado por el sistema). El backend extrae RFC, plan, plazo
 * y trámite. Si la extracción es completa, spawnea cotizar.js y devuelve un
 * job_id para polling (igual que cotizar-excel). Si hay campos faltantes,
 * muestra un formulario para que el usuario los complete.
 *
 * Toggle opcional "AB diferente": el usuario puede pedir re-cotizar con un
 * AB distinto al original (útil para comparar rentabilidades).
 *
 * Auth: cookie de sesión validada por el wrapper /api/cotizaciones/from-pdf
 * vía X-Auth. Si vence, redirigimos a /login.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCw,
  ExternalLink,
  X,
  Download,
  Mail,
} from "lucide-react";
import { Sidebar, type SidebarKey } from "@/components/admin/Sidebar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PollingStage = "normal" | "slow" | "very_slow" | "warning";

interface DatosExtraidos {
  rfc: string;
  cliente_nombre: string;
  tramite: string;
  plazo: number;
  perfiles: Array<{
    marca: string;
    modelo: string;
    plan: string;
    lineas: string;
    modalidad: string;
  }>;
  ab: number | null;
  aportacion: number;
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "partial";
      datos: DatosExtraidos;
      campos_faltantes: string[];
    }
  | {
      kind: "polling";
      id: string;
      startedAt: number;
      elapsedMs: number;
      stage: PollingStage;
    }
  | { kind: "success"; pdfUrl?: string; id: string }
  | { kind: "error"; message: string; timedOut?: boolean; id?: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000;
const STAGE_TICK_MS = 1_000;
const STAGE_THRESHOLDS = { slow: 30_000, verySlow: 90_000, warning: 180_000 } as const;

function stageFromElapsed(ms: number): PollingStage {
  if (ms >= STAGE_THRESHOLDS.warning) return "warning";
  if (ms >= STAGE_THRESHOLDS.verySlow) return "very_slow";
  if (ms >= STAGE_THRESHOLDS.slow) return "slow";
  return "normal";
}

const STAGE_COPY: Record<PollingStage, { title: string; body: string; tone: "info" | "warn" }> = {
  normal: { title: "Re-cotizando en Telcel…", body: "Suele tardar 1-4 minutos.", tone: "info" },
  slow: { title: "Trabajando con Telcel…", body: "Verificando plan y equipo.", tone: "info" },
  very_slow: { title: "Telcel tarda más de lo normal", body: "Sigue corriendo — portal lento.", tone: "info" },
  warning: { title: "Telcel está lento hoy", body: "Máximo 5 min. Puedes seguir en otra pestaña.", tone: "warn" },
};

const TRAMITES = ["ACTIVACION", "PORTABILIDAD", "RENOVACION", "CAMBIOPLAN"] as const;
const PLAZOS = [12, 18, 24, 36] as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CotizarPdfPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  // Toggle AB diferente
  const [useTargetAb, setUseTargetAb] = useState(false);
  const [targetAbStr, setTargetAbStr] = useState("");

  // Para completar campos faltantes (modo partial)
  const [fixRfc, setFixRfc] = useState("");
  const [fixTramite, setFixTramite] = useState("");
  const [fixPlazo, setFixPlazo] = useState("");
  const [fixPlan, setFixPlan] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearPolling() {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
    if (stageIntervalRef.current) { clearInterval(stageIntervalRef.current); stageIntervalRef.current = null; }
  }

  useEffect(() => () => clearPolling(), []);

  const isBusy = submit.kind === "loading" || submit.kind === "polling";

  function pickFile(f: File | null) {
    setLocalError(null);
    if (!f) { setFile(null); return; }
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setLocalError("El archivo debe ser .pdf");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setLocalError("Archivo muy grande (>20MB).");
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
    setSubmit({ kind: "polling", id, startedAt, elapsedMs: 0, stage: "normal" });

    const tick = async () => {
      try {
        const res = await fetch(`/api/cotizaciones/${encodeURIComponent(id)}`, {
          method: "GET", cache: "no-store",
        });
        if (res.status === 401) { clearPolling(); router.push("/login?next=/dashboard/cotizar-pdf"); return; }
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await res.json() as any;
        const cot = data.cotizacion;
        if (!cot) return;
        if (cot.estado === "completada") { clearPolling(); setSubmit({ kind: "success", id: cot.id, pdfUrl: cot.pdf_url }); }
        else if (cot.estado === "fallida") { clearPolling(); setSubmit({ kind: "error", id: cot.id, message: cot.error || "La cotización falló." }); }
      } catch { /* errores de red transitorios */ }
    };

    pollIntervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
    stageIntervalRef.current = setInterval(() => {
      setSubmit((prev) => {
        if (prev.kind !== "polling") return prev;
        const elapsedMs = Date.now() - prev.startedAt;
        const stage = stageFromElapsed(elapsedMs);
        return { ...prev, elapsedMs, stage };
      });
    }, STAGE_TICK_MS);
    pollTimeoutRef.current = setTimeout(() => {
      clearPolling();
      setSubmit({ kind: "error", id, timedOut: true, message: "Telcel no respondió en 5 minutos. Revisa Historial en unos minutos." });
    }, POLL_TIMEOUT_MS);
  }

  function handleCancel() {
    if (submit.kind !== "polling") return;
    const id = submit.id;
    clearPolling();
    setSubmit({ kind: "idle" });
    void fetch(`/api/cotizaciones/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }

  async function handleSubir() {
    if (!file || isBusy) return;
    setLocalError(null);
    setSubmit({ kind: "loading" });

    const targetAb = useTargetAb && targetAbStr ? parseFloat(targetAbStr) : undefined;

    // Leer PDF como base64
    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    const file_b64 = btoa(binary);

    const body: Record<string, unknown> = { file_b64 };
    if (targetAb !== undefined && !isNaN(targetAb)) body.target_ab = targetAb;

    try {
      const res = await apiFetch("/api/cotizaciones/from-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        window.location.href = "/login?next=/dashboard/cotizar-pdf";
        return;
      }
      if (!res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let message = "No pudimos procesar el PDF.";
        try { const d = await res.json() as { error?: string }; if (d?.error) message = d.error; } catch { /* */ }
        setSubmit({ kind: "error", message });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any;

      // Modo partial: faltan campos
      if (data.partial) {
        const d = data.datos_extraidos as DatosExtraidos;
        setFixRfc(d.rfc || "");
        setFixTramite(d.tramite || "");
        setFixPlazo(d.plazo ? String(d.plazo) : "");
        setFixPlan(d.perfiles?.[0]?.plan || "");
        setSubmit({ kind: "partial", datos: d, campos_faltantes: data.campos_faltantes || [] });
        return;
      }

      const cot = data.cotizacion;
      if (!cot?.id) { setSubmit({ kind: "error", message: "Respuesta inesperada del servidor." }); return; }

      if (cot.estado === "completada") { setSubmit({ kind: "success", id: cot.id, pdfUrl: cot.pdf_url }); return; }
      if (cot.estado === "fallida") { setSubmit({ kind: "error", message: cot.error || "Cotización fallida." }); return; }

      startPolling(cot.id);
    } catch {
      setSubmit({ kind: "error", message: "Sin conexión con el servidor. Revisa tu red." });
    }
  }

  /**
   * Re-envía con los campos corregidos por el usuario (modo partial).
   */
  async function handleRetryWithFixes() {
    if (submit.kind !== "partial" || !file) return;
    setLocalError(null);
    setSubmit({ kind: "loading" });

    const targetAb = useTargetAb && targetAbStr ? parseFloat(targetAbStr) : undefined;

    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    const file_b64 = btoa(binary);

    // Construir datos extendidos con fixes del usuario
    const body: Record<string, unknown> = {
      file_b64,
      // Campos corregidos se pasan como overrides
      override_rfc: fixRfc || undefined,
      override_tramite: fixTramite || undefined,
      override_plazo: fixPlazo ? parseInt(fixPlazo) : undefined,
      override_plan: fixPlan || undefined,
    };
    if (targetAb !== undefined && !isNaN(targetAb)) body.target_ab = targetAb;

    try {
      const res = await apiFetch("/api/cotizaciones/from-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { window.location.href = "/login?next=/dashboard/cotizar-pdf"; return; }
      if (!res.ok) {
        let message = "No pudimos cotizar.";
        try { const d = await res.json() as { error?: string }; if (d?.error) message = d.error; } catch { /* */ }
        setSubmit({ kind: "error", message });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any;
      if (data.partial) {
        setSubmit({ kind: "error", message: `Aún faltan campos: ${(data.campos_faltantes || []).join(", ")}` });
        return;
      }
      const cot = data.cotizacion;
      if (!cot?.id) { setSubmit({ kind: "error", message: "Respuesta inesperada." }); return; }
      startPolling(cot.id);
    } catch {
      setSubmit({ kind: "error", message: "Sin conexión con el servidor." });
    }
  }

  function reset() {
    clearPolling();
    setFile(null);
    setLocalError(null);
    setSubmit({ kind: "idle" });
    setUseTargetAb(false);
    setTargetAbStr("");
  }

  const sidebarActive = "cotizar-pdf" as SidebarKey;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar active={sidebarActive} />

      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-10 md:py-12">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <Link href="/dashboard" className="hover:text-indigo-600 transition">Inicio</Link>
            <span className="text-slate-300">/</span>
            <Link href="/dashboard/cotizar" className="hover:text-indigo-600 transition">Cotizar</Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">Re-cotizar desde PDF</span>
          </div>

          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-md shadow-indigo-200">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Re-cotizar desde PDF
              </h1>
            </div>
            <p className="text-sm md:text-base text-slate-600 max-w-2xl">
              Sube un PDF de una cotización anterior. El sistema extrae los datos automáticamente
              y re-cotiza igual — o con un AB diferente si lo necesitas.
            </p>
          </motion.header>

          {/* Card principal */}
          <motion.section
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 md:p-8"
          >
            {/* Dropzone */}
            <motion.div
              onDragEnter={(e) => { e.preventDefault(); if (!isBusy) setIsDragging(true); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => !isBusy && inputRef.current?.click()}
              role="button" tabIndex={0}
              aria-disabled={isBusy}
              aria-describedby={localError ? errorId : undefined}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isBusy) { e.preventDefault(); inputRef.current?.click(); } }}
              whileHover={!isBusy ? { scale: 1.005 } : undefined}
              transition={{ duration: 0.15 }}
              className={[
                "rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
                isBusy ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
                  : isDragging ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-300 bg-slate-50 hover:bg-indigo-50/40 hover:border-indigo-300",
              ].join(" ")}
            >
              <input
                ref={inputRef} type="file" accept=".pdf,application/pdf"
                className="hidden" disabled={isBusy}
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-white shadow-md shadow-emerald-100">
                    <FileText className="w-6 h-6" />
                  </span>
                  <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                  <button type="button" disabled={isBusy}
                    onClick={(e) => { e.stopPropagation(); pickFile(null); }}
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
                    Arrastra el PDF aquí o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-slate-500">Solo .pdf · Máximo 20MB</p>
                </div>
              )}
            </motion.div>

            {localError && (
              <div id={errorId} role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{localError}</span>
              </div>
            )}

            {/* Toggle AB diferente */}
            {submit.kind === "idle" && (
              <div className="mt-5 flex items-start gap-3">
                <input
                  id="toggle-ab" type="checkbox" checked={useTargetAb}
                  onChange={(e) => setUseTargetAb(e.target.checked)}
                  className="mt-1 rounded border-slate-300 text-indigo-600"
                />
                <label htmlFor="toggle-ab" className="text-sm text-slate-700 cursor-pointer select-none">
                  Re-cotizar con un <span className="font-semibold">AB diferente</span>
                </label>
                {useTargetAb && (
                  <div className="flex items-center gap-2 ml-2">
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={targetAbStr}
                      onChange={(e) => setTargetAbStr(e.target.value)}
                      placeholder="22.5"
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                )}
              </div>
            )}

            {/* Botón cotizar (idle) */}
            {submit.kind === "idle" && (
              <div className="mt-6">
                <motion.button
                  type="button" onClick={handleSubir} disabled={!file}
                  whileHover={file ? { scale: 1.02 } : undefined}
                  whileTap={file ? { scale: 0.98 } : undefined}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <Upload className="w-4 h-4" />
                  Analizar y cotizar
                </motion.button>
              </div>
            )}

            {submit.kind === "loading" && (
              <div className="mt-6">
                <button type="button" disabled
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold opacity-80 cursor-wait shadow-md shadow-indigo-200"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando PDF…
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* Modo partial: faltan campos */}
              {submit.kind === "partial" && (
                <motion.div key="partial"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: "easeOut" }}
                  className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-amber-900 font-bold">Datos parcialmente extraídos</p>
                      <p className="text-sm text-amber-800 mt-1">
                        Faltan: <span className="font-semibold">{submit.campos_faltantes.join(", ")}</span>.
                        Completa los campos para continuar.
                      </p>
                    </div>
                  </div>

                  {/* Formulario para completar */}
                  <div className="grid gap-3">
                    {submit.campos_faltantes.includes("rfc") && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">RFC</label>
                        <input type="text" value={fixRfc} onChange={(e) => setFixRfc(e.target.value.toUpperCase())}
                          placeholder="ABC123456XY0"
                          className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        />
                      </div>
                    )}
                    {submit.campos_faltantes.includes("tramite") && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Trámite</label>
                        <select value={fixTramite} onChange={(e) => setFixTramite(e.target.value)}
                          className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        >
                          <option value="">— seleccionar —</option>
                          {TRAMITES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    )}
                    {submit.campos_faltantes.includes("plazo") && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Plazo</label>
                        <select value={fixPlazo} onChange={(e) => setFixPlazo(e.target.value)}
                          className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        >
                          <option value="">— seleccionar —</option>
                          {PLAZOS.map((p) => <option key={p} value={String(p)}>{p} meses</option>)}
                        </select>
                      </div>
                    )}
                    {submit.campos_faltantes.includes("plan") && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Plan Telcel</label>
                        <input type="text" value={fixPlan} onChange={(e) => setFixPlan(e.target.value.toUpperCase())}
                          placeholder="TELCEL EMPRESA CONTROLADO VPN BASE"
                          className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Toggle AB diferente en modo partial */}
                    <div className="flex items-center gap-3 pt-1">
                      <input id="toggle-ab-partial" type="checkbox" checked={useTargetAb}
                        onChange={(e) => setUseTargetAb(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <label htmlFor="toggle-ab-partial" className="text-sm text-slate-700 cursor-pointer">
                        AB diferente
                      </label>
                      {useTargetAb && (
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" max="100" step="0.5"
                            value={targetAbStr} onChange={(e) => setTargetAbStr(e.target.value)}
                            placeholder="22.5"
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                          />
                          <span className="text-sm text-slate-500">%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <motion.button type="button" onClick={() => void handleRetryWithFixes()}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Cotizar con estos datos
                    </motion.button>
                    <button type="button" onClick={reset}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Subir otro PDF
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Polling */}
              {submit.kind === "polling" && (() => {
                const copy = STAGE_COPY[submit.stage];
                const isWarn = copy.tone === "warn";
                const elapsedS = Math.floor(submit.elapsedMs / 1000);
                const mins = Math.floor(elapsedS / 60);
                const secs = elapsedS % 60;
                const pct = Math.min(100, Math.round((submit.elapsedMs / POLL_TIMEOUT_MS) * 100));
                return (
                  <motion.div key="polling"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: "easeOut" }}
                    className={["mt-6 rounded-2xl border p-5", isWarn ? "border-amber-200 bg-amber-50" : "border-indigo-200 bg-indigo-50/60"].join(" ")}
                    role="status" aria-live="polite"
                  >
                    <div className="flex items-start gap-3">
                      <span className={["mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0", isWarn ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"].join(" ")}>
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={["font-bold", isWarn ? "text-amber-900" : "text-indigo-900"].join(" ")}>{copy.title}</p>
                        <p className={["text-sm mt-1", isWarn ? "text-amber-800" : "text-indigo-800"].join(" ")}>{copy.body}</p>
                        <div className={["mt-3 h-1.5 w-full rounded-full overflow-hidden", isWarn ? "bg-amber-200/70" : "bg-indigo-100"].join(" ")}>
                          <motion.div initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }}
                            className={["h-full", isWarn ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-indigo-500 to-cyan-500"].join(" ")} />
                        </div>
                        <p className={["text-xs mt-2 tabular-nums", isWarn ? "text-amber-700" : "text-indigo-700"].join(" ")}>
                          Tiempo: {mins}:{secs.toString().padStart(2, "0")} / 5:00
                          {" · Folio "}<span className="font-mono">{submit.id}</span>
                        </p>
                      </div>
                      <button type="button" onClick={handleCancel}
                        className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-rose-700 px-2.5 py-1.5 rounded-full hover:bg-rose-50 transition self-start"
                        aria-label="Cancelar la cotización en curso"
                      >
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Success */}
              {submit.kind === "success" && (
                <motion.div key="success"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: "easeOut" }}
                  className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-emerald-900 font-bold">Cotización lista</p>
                      <p className="text-sm text-emerald-800 mt-1">Folio: <span className="font-mono">{submit.id}</span></p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {submit.pdfUrl && (
                          <motion.a href={submit.pdfUrl} target="_blank" rel="noopener noreferrer"
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-200 hover:shadow-lg transition"
                          >
                            <Download className="w-4 h-4" /> Descargar PDF <ExternalLink className="w-3.5 h-3.5" />
                          </motion.a>
                        )}
                        <Link href="/dashboard/historial"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-emerald-300 text-emerald-800 text-sm font-semibold hover:bg-emerald-100 transition"
                        >
                          Ver historial
                        </Link>
                        <button type="button" onClick={reset}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                        >
                          <RotateCw className="w-3.5 h-3.5" /> Subir otro PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {submit.kind === "error" && (
                <motion.div key="error"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: "easeOut" }}
                  className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-700 shrink-0">
                      <XCircle className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-rose-900 font-bold">{submit.timedOut ? "Telcel no respondió" : "No pudimos cotizar"}</p>
                      <p className="text-sm text-rose-800 mt-1">{submit.message}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <motion.button type="button" onClick={reset}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 text-white text-sm font-semibold shadow-md shadow-rose-200 hover:shadow-lg transition"
                        >
                          <RotateCw className="w-4 h-4" /> Reintentar
                        </motion.button>
                        {submit.timedOut && (
                          <>
                            <Link href="/dashboard/historial"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-rose-300 text-rose-800 text-sm font-semibold hover:bg-rose-100 transition"
                            >
                              Ver historial
                            </Link>
                            <a href={`mailto:soporte@hectoria.mx?subject=${encodeURIComponent("Telcel timeout — PDF")}&body=${encodeURIComponent(`Folio: ${submit.id || "?"}\nHora: ${new Date().toLocaleString("es-MX")}`)}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                            >
                              <Mail className="w-3.5 h-3.5" /> Reportar problema
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

          {/* Tip informativo */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="mt-6 rounded-xl bg-indigo-50 border border-indigo-100 px-5 py-4 text-sm text-indigo-800"
          >
            <p className="font-semibold mb-1">Formatos soportados</p>
            <ul className="list-disc list-inside space-y-0.5 text-indigo-700">
              <li>FormatoCliente_*.pdf y FormatoInterno_*.pdf generados por el sistema</li>
              <li>PDFs con texto extraíble (no imágenes escaneadas)</li>
              <li>Si el PDF está encriptado, ábrelo, guárdalo sin contraseña y súbelo de nuevo</li>
            </ul>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
