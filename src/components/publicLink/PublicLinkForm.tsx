"use client";

/**
 * PublicLinkForm — Formulario de captura de lead G-1.
 *
 * Estados internos:
 *   idle       → muestra el form (RFC + equipo + líneas + email + teléfono)
 *   submitting → spinner "Enviando…"
 *   polling    → skeleton progress + polling cada 3s
 *   done       → tarjeta resultado (monto NumberFlow + PDF link)
 *   error      → mensaje de error con CTA de reintento
 *
 * Mobile-first: el cliente final probablemente abre en celular.
 */

import { useCallback, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import NumberFlow from "@number-flow/react";
import type { PublicLinkMeta, StatusResponse } from "@/lib/publicLinkApi";
import { submitPublicLink, pollSubmissionStatus, validarRfc } from "@/lib/publicLinkApi";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  slug: string;
  meta: PublicLinkMeta;
}

type Phase = "idle" | "submitting" | "polling" | "done" | "error";

// ── Constantes ───────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000;
// Timeout de 10 minutos (las cotizaciones Playwright tardan 3-7 min en producción)
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

// ── Componente principal ─────────────────────────────────────────────────────

export function PublicLinkForm({ slug, meta }: Props) {
  // Form fields
  const [rfc, setRfc] = useState("");
  const [equipoInteres, setEquipoInteres] = useState("");
  const [lineas, setLineas] = useState<string>("1");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  // UI state
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultado, setResultado] = useState<StatusResponse | null>(null);
  const [pollProgress, setPollProgress] = useState(0); // 0-100

  // Ids para a11y
  const rfcId = useId();
  const equipoId = useId();
  const lineasId = useId();
  const emailId = useId();
  const telefonoId = useId();
  const errorId = useId();

  // Refs para cleanup
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // RFC validation inline
  const rfcTipo = validarRfc(rfc);
  const rfcValido = rfcTipo !== null;
  const rfcDirty = rfc.length >= 4;

  // ── Polling ────────────────────────────────────────────────────────────────

  const startPolling = useCallback(
    (submissionId: string) => {
      setPhase("polling");
      pollStartRef.current = Date.now();
      setPollProgress(5);

      pollTimerRef.current = setInterval(async () => {
        const elapsed = Date.now() - pollStartRef.current;

        // Progreso sintético: avanza hasta 95 % y espera a que llegue la respuesta.
        const syntheticPct = Math.min(95, Math.round((elapsed / POLL_TIMEOUT_MS) * 100 * 10));
        setPollProgress(syntheticPct);

        if (elapsed > POLL_TIMEOUT_MS) {
          clearInterval(pollTimerRef.current!);
          setPhase("error");
          setErrorMsg(
            "La cotización está tardando más de lo habitual. " +
              "Revisa tu email en unos minutos — si ya se generó, te llegó ahí. " +
              "Si no, contáctanos.",
          );
          return;
        }

        const status = await pollSubmissionStatus(slug, submissionId);
        if (!status) return; // error de red transitorio — reintentar en el próximo tick

        if (status.estado === "completada") {
          clearInterval(pollTimerRef.current!);
          setPollProgress(100);
          setResultado(status);
          setPhase("done");
        } else if (status.estado === "fallida") {
          clearInterval(pollTimerRef.current!);
          setPhase("error");
          setErrorMsg(
            status.error ||
              "La cotización no pudo completarse. Contacta a quien te envió este link para más información.",
          );
        }
        // "processing" → seguir polling
      }, POLL_INTERVAL_MS);
    },
    [slug],
  );

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rfcValido) return;

    setPhase("submitting");
    setErrorMsg(null);

    const result = await submitPublicLink(slug, {
      rfc: rfc.trim().toUpperCase(),
      equipo_interes: equipoInteres.trim() || undefined,
      lineas: Math.max(1, parseInt(lineas, 10) || 1),
      email_contacto: email.trim() || undefined,
      telefono_contacto: telefono.trim() || undefined,
    });

    if (!result.ok) {
      setPhase("error");
      setErrorMsg(result.message);
      return;
    }

    startPolling(result.data.submission_id);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Form
              rfc={rfc} setRfc={setRfc}
              rfcId={rfcId} rfcValido={rfcValido} rfcTipo={rfcTipo} rfcDirty={rfcDirty}
              equipoInteres={equipoInteres} setEquipoInteres={setEquipoInteres} equipoId={equipoId}
              lineas={lineas} setLineas={setLineas} lineasId={lineasId}
              email={email} setEmail={setEmail} emailId={emailId}
              telefono={telefono} setTelefono={setTelefono} telefonoId={telefonoId}
              onSubmit={handleSubmit}
              meta={meta}
            />
          </motion.div>
        )}

        {phase === "submitting" && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-6 py-16"
          >
            <Spinner />
            <p className="text-base font-semibold text-slate-700">Enviando tu solicitud…</p>
          </motion.div>
        )}

        {phase === "polling" && (
          <motion.div
            key="polling"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <PollingView progress={pollProgress} vendedor={meta.vendedor_nombre} />
          </motion.div>
        )}

        {phase === "done" && resultado && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <ResultCard resultado={resultado} meta={meta} />
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ErrorView
              id={errorId}
              message={errorMsg ?? "Ocurrió un error inesperado."}
              onRetry={() => {
                setPhase("idle");
                setErrorMsg(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

interface FormProps {
  rfc: string; setRfc: (v: string) => void; rfcId: string;
  rfcValido: boolean; rfcTipo: "pf" | "pm" | null; rfcDirty: boolean;
  equipoInteres: string; setEquipoInteres: (v: string) => void; equipoId: string;
  lineas: string; setLineas: (v: string) => void; lineasId: string;
  email: string; setEmail: (v: string) => void; emailId: string;
  telefono: string; setTelefono: (v: string) => void; telefonoId: string;
  onSubmit: (e: React.FormEvent) => void;
  meta: PublicLinkMeta;
}

function Form({
  rfc, setRfc, rfcId, rfcValido, rfcTipo, rfcDirty,
  equipoInteres, setEquipoInteres, equipoId,
  lineas, setLineas, lineasId,
  email, setEmail, emailId,
  telefono, setTelefono, telefonoId,
  onSubmit, meta,
}: FormProps) {
  const emailVacio = email.trim().length === 0;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {/* RFC */}
      <div>
        <label
          htmlFor={rfcId}
          className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1"
        >
          RFC de su empresa <span className="text-rose-500">*</span>
        </label>
        <input
          id={rfcId}
          type="text"
          required
          maxLength={13}
          value={rfc}
          onChange={(e) => setRfc(e.target.value.toUpperCase())}
          placeholder="XYZ890123ABC"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={`${rfcId}-hint`}
          aria-invalid={rfcDirty && !rfcValido}
          className={[
            "w-full rounded-2xl px-4 py-3.5 text-slate-900 font-mono text-base",
            "bg-slate-50 border transition-all font-medium tracking-wider",
            "placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal",
            "focus:outline-none focus:bg-white focus:ring-4",
            rfcDirty && !rfcValido
              ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100/60"
              : rfcValido
                ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100/60"
                : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-100/50",
          ].join(" ")}
        />
        <p id={`${rfcId}-hint`} className="mt-1.5 ml-1 text-xs min-h-[18px]">
          {rfcDirty && !rfcValido && (
            <span className="text-rose-500 font-medium">RFC inválido — revise el formato SAT</span>
          )}
          {rfcValido && rfcTipo === "pm" && (
            <span className="text-emerald-600 font-semibold">RFC válido · Persona Moral</span>
          )}
          {rfcValido && rfcTipo === "pf" && (
            <span className="text-emerald-600 font-semibold">
              RFC válido · Persona Física — solo aplica Cambio de Plan
            </span>
          )}
        </p>
      </div>

      {/* Equipo + Líneas en grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={equipoId}
            className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1"
          >
            Equipo de interés
          </label>
          <input
            id={equipoId}
            type="text"
            value={equipoInteres}
            onChange={(e) => setEquipoInteres(e.target.value)}
            placeholder="Ej. iPhone 15 Pro Max"
            className="w-full rounded-2xl px-4 py-3.5 text-slate-900 text-base bg-slate-50 border border-slate-200 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium"
          />
        </div>
        <div>
          <label
            htmlFor={lineasId}
            className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1"
          >
            Número de líneas <span className="text-rose-500">*</span>
          </label>
          <input
            id={lineasId}
            type="number"
            required
            min={1}
            max={9999}
            value={lineas}
            onChange={(e) => setLineas(e.target.value)}
            placeholder="10"
            className="w-full rounded-2xl px-4 py-3.5 text-slate-900 text-base bg-slate-50 border border-slate-200 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium tabular-nums"
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor={emailId}
          className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1"
        >
          Email para recibir la propuesta
        </label>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="compras@miempresa.com"
          autoComplete="email"
          className="w-full rounded-2xl px-4 py-3.5 text-slate-900 text-base bg-slate-50 border border-slate-200 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium"
        />
        <AnimatePresence>
          {emailVacio && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1.5 ml-1 text-xs text-amber-600 font-medium"
            >
              Te recomendamos agregar tu email para recibir la cotización en PDF.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Teléfono */}
      <div>
        <label
          htmlFor={telefonoId}
          className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1"
        >
          Teléfono de contacto{" "}
          <span className="text-slate-400 font-normal normal-case tracking-normal">(opcional)</span>
        </label>
        <input
          id={telefonoId}
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="55 1234 5678"
          autoComplete="tel"
          className="w-full rounded-2xl px-4 py-3.5 text-slate-900 text-base bg-slate-50 border border-slate-200 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium"
        />
      </div>

      {/* CTA */}
      <div className="pt-2">
        <motion.button
          type="submit"
          disabled={!rfcValido}
          whileHover={rfcValido ? { scale: 1.015 } : {}}
          whileTap={rfcValido ? { scale: 0.985 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className={[
            "relative w-full overflow-hidden rounded-full py-4 px-6",
            "font-bold text-base text-white transition-shadow",
            rfcValido
              ? "bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 shadow-[0_10px_30px_rgba(79,70,229,0.30)] hover:shadow-[0_14px_36px_rgba(79,70,229,0.40)] cursor-pointer"
              : "bg-slate-300 cursor-not-allowed",
            "group",
          ].join(" ")}
        >
          {/* Shimmer */}
          {rfcValido && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
            />
          )}
          <span className="relative inline-flex items-center justify-center gap-2">
            Solicitar cotización
            <ArrowRightIcon />
          </span>
        </motion.button>
      </div>

      {/* Trust signals */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
        <TrustPill icon={<LockIcon />} text="Datos protegidos por LFPDPPP" />
        <TrustPill icon={<CheckIcon />} text="Sin crear cuenta" />
        {meta.distribuidor_nombre && (
          <TrustPill icon={<ShieldIcon />} text={meta.distribuidor_nombre} />
        )}
      </div>
    </form>
  );
}

function TrustPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[11px] font-semibold text-slate-500">
      <span className="w-3 h-3 text-slate-400">{icon}</span>
      {text}
    </span>
  );
}

// ── Polling view ─────────────────────────────────────────────────────────────

function PollingView({ progress, vendedor }: { progress: number; vendedor?: string }) {
  const messages = [
    "Consultando el portal Telcel…",
    "Buscando planes disponibles…",
    "Calculando la mejor propuesta…",
    "Generando tu cotización personalizada…",
    "Preparando el PDF oficial…",
  ];
  // Seleccionar mensaje según progreso
  const msgIdx = Math.min(messages.length - 1, Math.floor((progress / 100) * messages.length));
  const msg = messages[msgIdx];

  return (
    <div className="py-8 flex flex-col items-center gap-8">
      {/* Check recibido */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200/50"
      >
        <CheckIconLg />
      </motion.div>

      <div className="text-center space-y-1">
        <p className="text-xl font-extrabold text-slate-900 tracking-tight">Solicitud recibida</p>
        <p className="text-sm text-slate-500">
          {vendedor ? `${vendedor} está generando su propuesta personalizada.` : "Generando su propuesta personalizada."}
        </p>
      </div>

      {/* Progress bar + skeleton */}
      <div className="w-full max-w-sm space-y-3">
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
            initial={{ width: "5%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="text-xs text-slate-500 text-center font-medium">{msg}</p>
      </div>

      {/* Skeleton cards */}
      <div className="w-full max-w-sm space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 rounded-xl bg-slate-100 animate-pulse"
            style={{ opacity: 1 - i * 0.25 }}
          />
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center max-w-xs">
        Esto puede tardar hasta 5 minutos. No cierre esta página — también le
        enviaremos la cotización por email.
      </p>
    </div>
  );
}

// ── Result card ──────────────────────────────────────────────────────────────

function ResultCard({ resultado, meta }: { resultado: StatusResponse; meta: PublicLinkMeta }) {
  const monto = resultado.monto_total ?? 0;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-xl shadow-indigo-200/50"
      >
        <CheckIconLg />
      </motion.div>

      <div className="text-center">
        <p className="text-2xl font-extrabold text-slate-900 tracking-tight">Propuesta lista</p>
        {resultado.folio && (
          <p className="text-sm text-slate-500 mt-1 font-mono">
            Folio: <span className="text-cyan-600 font-bold">{resultado.folio}</span>
          </p>
        )}
      </div>

      {/* Tarjeta de resultado */}
      <motion.div
        className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-indigo-100/40 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Monto */}
        {monto > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Total de la propuesta
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                $<NumberFlow
                  value={monto}
                  format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                />
              </span>
              <span className="text-base text-slate-400 font-medium">MXN</span>
            </div>
          </div>
        )}

        {/* Email */}
        <p className="text-sm text-slate-600 leading-relaxed">
          Hemos enviado la cotización detallada a su correo electrónico.
          {meta.vendedor_nombre && (
            <> Su contacto es <span className="font-semibold text-slate-900">{meta.vendedor_nombre}</span>.</>
          )}
        </p>

        {/* PDF button */}
        {resultado.pdf_url && (
          <a
            href={resultado.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative w-full inline-flex items-center justify-center gap-2 overflow-hidden rounded-full py-3.5 px-6 font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-[0_10px_30px_rgba(79,70,229,0.28)] hover:shadow-[0_14px_36px_rgba(79,70,229,0.38)] transition-shadow group"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
            />
            <DownloadIcon />
            Descargar PDF
          </a>
        )}
      </motion.div>

      {/* Ayuda */}
      <p className="text-xs text-slate-500 text-center max-w-xs leading-relaxed">
        Si tiene preguntas o desea ajustar la propuesta, contacte directamente a{" "}
        {meta.vendedor_nombre ? (
          <span className="font-semibold text-slate-700">{meta.vendedor_nombre}</span>
        ) : (
          "su vendedor"
        )}
        {meta.distribuidor_nombre && (
          <> de <span className="font-semibold text-slate-700">{meta.distribuidor_nombre}</span></>
        )}
        .
      </p>
    </div>
  );
}

// ── Error view ───────────────────────────────────────────────────────────────

function ErrorView({
  id,
  message,
  onRetry,
}: {
  id: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8" role="alert" id={id}>
      <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500">
        <XCircleIcon />
      </div>
      <div className="text-center space-y-2">
        <p className="text-base font-bold text-slate-900">Algo salió mal</p>
        <p className="text-sm text-slate-600 max-w-sm leading-relaxed">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div
      aria-label="Cargando"
      className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"
    />
  );
}

// ── Iconos inline (sin dependencias extra) ───────────────────────────────────

function ArrowRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIconLg() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-8 h-8"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M8.5 1.709a1 1 0 0 0-1 0L3.25 3.956a.5.5 0 0 0-.25.434v1.298c0 3.468 1.958 6.617 5.022 8.063.239.113.516.113.755 0C11.843 12.305 13.8 9.156 13.8 5.688V4.39a.5.5 0 0 0-.25-.434L8.5 1.709Zm2.916 4.665a.75.75 0 0 0-1.132-.987L7.878 8.13 6.75 7.178a.75.75 0 1 0-.97 1.143l1.625 1.378a.75.75 0 0 0 1.05-.078l2.962-3.347Z" clipRule="evenodd"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden>
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
