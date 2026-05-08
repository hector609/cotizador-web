"use client";

/**
 * /dashboard/cotizar — formulario web multi-paso para crear una cotización.
 *
 * Dos modos:
 *  - Wizard:   3 pasos (Cliente → Detalles → Confirmación) con dropdowns
 *              alimentados por GET /api/catalogos/equipos y
 *              GET /api/catalogos/planes (proxies al bot). Fallback graceful
 *              a lista corta hardcoded si el backend aún no expone catálogo.
 *  - Experto:  textarea libre. POST /api/experto pasa el texto a Claude vía
 *              backend, recibe campos parseados (marca, modelo, líneas, plan,
 *              plazo, rfc, missing_fields, confidence) y muestra una tarjeta
 *              de confirmación editable antes de mandar a /api/cotizaciones.
 *
 * Estado: useState (sin react-hook-form / zod / SWR) para mantener el bundle
 * pequeño — la superficie del form es chica.
 *
 * Auth: el wrapper /api/cotizaciones (Route Handler) valida la cookie de
 * sesión. Aquí no necesitamos getSession() server-side porque la página
 * es Client Component; si la sesión está vencida el POST devolverá 401 y
 * mostramos error inline para no perder el form a medio llenar.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import {
  RFC_REGEX,
  type CrearCotizacionInput,
  type CrearCotizacionResponse,
} from "@/types/cotizacion";

/**
 * Polling: el backend procesa la cotización async (Playwright tarda 2-4 min).
 * Tras el POST inicial el endpoint regresa 202 con `cotizacion.id` y estado
 * "pendiente". El cliente pollea GET /api/cotizaciones/{id} cada 5s hasta que
 * estado sea "completada" o "fallida". Se aborta a los 5 min para evitar
 * spinners eternos si algo se cuelga upstream.
 */
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000;

/* ---------- Tipos del catálogo / experto ---------- */

interface EquipoCatalogo {
  /** Label que se manda al backend (e.g. "iPhone 15 128GB"). */
  label: string;
  marca?: string;
  modelo?: string;
  capacidad?: string;
  /** ID interno opcional. El backend acepta `label` o `id`. */
  id?: string;
}

interface PlanCatalogo {
  /** Label legible (e.g. "Plan Empresa 800 MXN — 24 meses"). */
  label: string;
  /** Renta mensual en MXN; lo usamos como `plan` en el payload. */
  precio: number;
  /** Empresa | Corporativo. */
  grupo?: string;
  /** CPP | AA | MPP. */
  modalidad?: string;
  /** 12 | 18 | 24 | 36. */
  plazo?: number;
  id?: string;
}

interface ExpertoResponse {
  /** El backend incluye unavailable=true si el endpoint aún no existe. */
  unavailable?: boolean;
  rfc?: string | null;
  marca?: string | null;
  modelo?: string | null;
  equipo?: string | null;
  lineas?: number | null;
  plan?: number | null;
  plazo?: number | null;
  modalidad?: string | null;
  grupo?: string | null;
  equipos_qty?: number | null;
  /** Campos que Claude no pudo determinar. */
  missing_fields?: string[];
  /** 0..1. Si <0.6 mostramos warning. */
  confidence?: number;
  /** Mensaje libre que Claude regresa para humanos. */
  notas?: string;
  error?: string;
}

/* ---------- Fallback hardcoded cuando catálogo no disponible ---------- */

const EQUIPOS_FALLBACK: EquipoCatalogo[] = [
  { label: "iPhone 15", marca: "Apple", modelo: "iPhone 15" },
  { label: "iPhone 15 Pro", marca: "Apple", modelo: "iPhone 15 Pro" },
  { label: "Samsung Galaxy S24", marca: "Samsung", modelo: "Galaxy S24" },
  { label: "Motorola Edge 50", marca: "Motorola", modelo: "Edge 50" },
];

const SIN_EQUIPO_LABEL = "Sin equipo";

type Mode = "wizard" | "experto";
type Step = 1 | 2 | 3;
type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "polling"; id: string }
  | { kind: "success"; pdfUrl?: string; id: string }
  | { kind: "error"; message: string };

export default function CotizarPage() {
  // useSearchParams() obliga a CSR-bailout; envolver en Suspense para que
  // Next 16 pueda prerender el shell sin crashear el build estático.
  return (
    <Suspense fallback={<CotizarFallback />}>
      <CotizarPageInner />
    </Suspense>
  );
}

function CotizarFallback() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="mt-6 h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      </div>
    </main>
  );
}

function CotizarPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  // Modo activo
  const [mode, setMode] = useState<Mode>("wizard");

  // Step 1
  const [tieneRfc, setTieneRfc] = useState<"si" | "no">("si");
  const [rfc, setRfc] = useState<string>(() => (params.get("rfc") || "").toUpperCase());
  const [rfcTouched, setRfcTouched] = useState(false);

  // Step 2
  const [lineas, setLineas] = useState<number>(1);
  const [plan, setPlan] = useState<number>(500);
  const [equipo, setEquipo] = useState<string>(SIN_EQUIPO_LABEL);
  const [equiposQty, setEquiposQty] = useState<number>(0);

  // Wizard
  const [step, setStep] = useState<Step>(1);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  // Catálogos
  const [equiposCatalog, setEquiposCatalog] = useState<EquipoCatalogo[]>(EQUIPOS_FALLBACK);
  const [equiposUnavailable, setEquiposUnavailable] = useState(false);
  const [planesCatalog, setPlanesCatalog] = useState<PlanCatalogo[]>([]);
  const [planesUnavailable, setPlanesUnavailable] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Modo experto
  const [expertoTexto, setExpertoTexto] = useState("");
  const [expertoLoading, setExpertoLoading] = useState(false);
  const [expertoParsed, setExpertoParsed] = useState<ExpertoResponse | null>(null);
  const [expertoError, setExpertoError] = useState<string | null>(null);

  // Polling refs: guardamos el interval handle y un timeout de corte para
  // poder limpiarlos desde múltiples lugares (success, error, unmount).
  // Refs en lugar de state porque NO queremos re-render cuando cambian.
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

  // Cleanup en unmount: si el usuario navega fuera mientras pollea, abortar.
  useEffect(() => {
    return () => clearPolling();
  }, []);

  // Si entró con ?rfc=..., normaliza y arranca con "Sí".
  useEffect(() => {
    const fromQuery = params.get("rfc");
    if (fromQuery) {
      setRfc(fromQuery.toUpperCase());
      setTieneRfc("si");
    }
  }, [params]);

  // Si elige "Sin equipo", forzar 0 (y deshabilitar el input — ver render).
  useEffect(() => {
    if (equipo === SIN_EQUIPO_LABEL && equiposQty !== 0) setEquiposQty(0);
  }, [equipo, equiposQty]);

  // Si líneas baja por debajo de equiposQty, recortar para mantener invariante.
  useEffect(() => {
    if (equiposQty > lineas) setEquiposQty(lineas);
  }, [lineas, equiposQty]);

  /**
   * Carga catálogos de equipos y planes en paralelo. Si el backend aún no
   * los expone (404 → unavailable=true), mantenemos el fallback hardcoded
   * y mostramos un warning sutil al usuario.
   */
  useEffect(() => {
    let alive = true;
    setCatalogLoading(true);

    (async () => {
      try {
        const [eqRes, plRes] = await Promise.all([
          fetch("/api/catalogos/equipos", { cache: "no-store" }),
          fetch("/api/catalogos/planes", { cache: "no-store" }),
        ]);

        if (!alive) return;

        if (eqRes.ok) {
          const data = (await eqRes.json()) as {
            equipos?: EquipoCatalogo[];
            unavailable?: boolean;
          };
          if (data.unavailable || !Array.isArray(data.equipos) || data.equipos.length === 0) {
            setEquiposCatalog(EQUIPOS_FALLBACK);
            setEquiposUnavailable(true);
          } else {
            setEquiposCatalog(data.equipos);
            setEquiposUnavailable(false);
          }
        } else {
          setEquiposCatalog(EQUIPOS_FALLBACK);
          setEquiposUnavailable(true);
        }

        if (plRes.ok) {
          const data = (await plRes.json()) as {
            planes?: PlanCatalogo[];
            unavailable?: boolean;
          };
          if (data.unavailable || !Array.isArray(data.planes) || data.planes.length === 0) {
            setPlanesCatalog([]);
            setPlanesUnavailable(true);
          } else {
            setPlanesCatalog(data.planes);
            setPlanesUnavailable(false);
          }
        } else {
          setPlanesCatalog([]);
          setPlanesUnavailable(true);
        }
      } catch {
        if (!alive) return;
        // Red caída: usar fallbacks completos.
        setEquiposCatalog(EQUIPOS_FALLBACK);
        setEquiposUnavailable(true);
        setPlanesCatalog([]);
        setPlanesUnavailable(true);
      } finally {
        if (alive) setCatalogLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const rfcValido = useMemo(() => RFC_REGEX.test(rfc), [rfc]);
  const rfcError =
    tieneRfc === "si" && rfcTouched && !rfcValido
      ? "RFC inválido. Formato esperado: XAXX010101000."
      : null;

  const step1Valido = tieneRfc === "no" || (tieneRfc === "si" && rfcValido);
  const step2Valido =
    Number.isInteger(lineas) &&
    lineas >= 1 &&
    lineas <= 500 &&
    plan >= 100 &&
    plan <= 5000 &&
    Number.isInteger(equiposQty) &&
    equiposQty >= 0 &&
    equiposQty <= lineas &&
    (equipo !== SIN_EQUIPO_LABEL || equiposQty === 0);

  function next() {
    if (step === 1 && step1Valido) setStep(2);
    else if (step === 2 && step2Valido) setStep(3);
  }
  function back() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  /**
   * Inicia el loop de polling para una cotización pendiente.
   * Idempotente: limpia cualquier polling previo antes de arrancar.
   */
  function startPolling(id: string) {
    clearPolling();
    setSubmit({ kind: "polling", id });

    const tick = async () => {
      try {
        const res = await fetch(`/api/cotizaciones/${encodeURIComponent(id)}`, {
          method: "GET",
          cache: "no-store",
        });

        if (res.status === 401) {
          clearPolling();
          router.push("/login?next=/dashboard/cotizar");
          return;
        }

        if (!res.ok) {
          // 5xx/transient → seguimos polleando (puede ser deploy, blip, etc.).
          // El timeout de 5min eventualmente cortará si nunca recupera.
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
            message: cot.error || "La cotización falló en el portal del operador.",
          });
        }
        // pendiente → seguimos esperando.
      } catch {
        // Errores de red transitorios: dejamos que el siguiente tick reintente.
      }
    };

    // Arrancar inmediato + cada 5s. El primer tick ayuda a UX cuando el
    // backend ya completó muy rápido (ej. cache hit) sin tener que esperar 5s.
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

  async function submitCotizacion(payload: CrearCotizacionInput) {
    if (submit.kind === "loading" || submit.kind === "polling") return;
    setSubmit({ kind: "loading" });

    try {
      const res = await fetch("/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push("/login?next=/dashboard/cotizar");
        return;
      }

      if (!res.ok) {
        let message = "No pudimos crear la cotización. Inténtalo otra vez.";
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

      // Si el backend ya devuelve completada/fallida en el POST (caso raro
      // pero posible si tuvo cache hit), saltamos el polling.
      if (cot.estado === "completada") {
        setSubmit({ kind: "success", id: cot.id, pdfUrl: cot.pdf_url });
        return;
      }
      if (cot.estado === "fallida") {
        setSubmit({
          kind: "error",
          message: cot.error || "La cotización falló en el portal del operador.",
        });
        return;
      }

      // Estado pendiente: arrancar polling.
      startPolling(cot.id);
    } catch {
      setSubmit({
        kind: "error",
        message: "Sin conexión con el servidor. Revisa tu red e inténtalo otra vez.",
      });
    }
  }

  async function handleSubmit() {
    const payload: CrearCotizacionInput = {
      rfc: tieneRfc === "si" ? rfc : undefined,
      lineas,
      plan,
      equipo: equipo === SIN_EQUIPO_LABEL ? undefined : equipo,
      equipos_qty: equiposQty,
    };
    await submitCotizacion(payload);
  }

  function handleRetry() {
    clearPolling();
    setSubmit({ kind: "idle" });
  }

  /**
   * Llama al endpoint /api/experto. Tras parsear, populamos los inputs del
   * wizard (lineas/plan/equipo/rfc/equiposQty) para que el usuario pueda
   * ajustar y confirmar — single source of truth para el submit posterior.
   */
  async function handleAnalizarExperto() {
    const texto = expertoTexto.trim();
    if (!texto) {
      setExpertoError("Escribe la cotización en lenguaje natural.");
      return;
    }
    setExpertoError(null);
    setExpertoLoading(true);
    setExpertoParsed(null);

    try {
      const res = await fetch("/api/experto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });

      if (res.status === 401) {
        router.push("/login?next=/dashboard/cotizar");
        return;
      }

      const data = (await res.json()) as ExpertoResponse;

      if (!res.ok) {
        setExpertoError(data?.error || "No pudimos analizar el texto.");
        return;
      }

      if (data.unavailable) {
        setExpertoError(
          data.error ||
            "Modo experto aún no disponible. Cambia a Wizard.",
        );
        return;
      }

      setExpertoParsed(data);

      // Auto-llenar inputs del wizard con los campos parseados (los que vengan).
      if (typeof data.rfc === "string" && data.rfc) {
        const upper = data.rfc.toUpperCase();
        setRfc(upper);
        setTieneRfc("si");
        setRfcTouched(true);
      }
      if (typeof data.lineas === "number" && data.lineas > 0) {
        setLineas(Math.max(1, Math.min(500, Math.floor(data.lineas))));
      }
      if (typeof data.plan === "number" && data.plan > 0) {
        setPlan(Math.max(100, Math.min(5000, Math.floor(data.plan))));
      }
      if (typeof data.equipo === "string" && data.equipo) {
        setEquipo(data.equipo);
      } else if (typeof data.modelo === "string" && data.modelo) {
        const label = data.marca ? `${data.marca} ${data.modelo}` : data.modelo;
        setEquipo(label);
      }
      if (typeof data.equipos_qty === "number" && data.equipos_qty >= 0) {
        setEquiposQty(Math.floor(data.equipos_qty));
      } else if (
        typeof data.lineas === "number" &&
        data.lineas > 0 &&
        ((typeof data.equipo === "string" && data.equipo) ||
          (typeof data.modelo === "string" && data.modelo))
      ) {
        // Default razonable: si hay equipo + líneas pero qty no especificada,
        // asumir que cada línea trae equipo.
        setEquiposQty(Math.max(1, Math.min(500, Math.floor(data.lineas))));
      }
    } catch {
      setExpertoError("Sin conexión con el servidor. Revisa tu red.");
    } finally {
      setExpertoLoading(false);
    }
  }

  async function handleCotizarExperto() {
    if (!expertoParsed) return;

    // Validar mínimos antes de enviar (la UI ya tiene los valores en los
    // states del wizard, pero confirmamos aquí para feedback inmediato).
    if (tieneRfc === "si" && !RFC_REGEX.test(rfc)) {
      setExpertoError("RFC inválido. Corrígelo antes de cotizar.");
      return;
    }
    if (!Number.isInteger(lineas) || lineas < 1 || lineas > 500) {
      setExpertoError("Número de líneas inválido (1-500).");
      return;
    }
    if (plan < 100 || plan > 5000) {
      setExpertoError("Plan fuera de rango (100-5000 MXN).");
      return;
    }

    setExpertoError(null);
    const payload: CrearCotizacionInput = {
      rfc: tieneRfc === "si" ? rfc : undefined,
      lineas,
      plan,
      equipo: equipo === SIN_EQUIPO_LABEL ? undefined : equipo,
      equipos_qty: equiposQty,
    };
    await submitCotizacion(payload);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">
            Cotizador Inteligente para DATS
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
              Inicio
            </Link>
            <Link href="/dashboard/cotizar" className="text-blue-700 font-medium">
              Cotizar
            </Link>
            <Link
              href="/dashboard/historial"
              className="text-slate-600 hover:text-slate-900"
            >
              Historial
            </Link>
            <Link
              href="/dashboard/clientes"
              className="text-slate-600 hover:text-slate-900"
            >
              Clientes
            </Link>
            <Link href="/" className="text-slate-500 hover:text-slate-700 ml-4">
              Salir
            </Link>
          </nav>
        </div>
      </header>

      <Section bg="slate" spacing="sm" width="narrow">
        <div className="mb-6">
          <Badge variant="muted" uppercase={false}>
            Web
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-3">
            Nueva cotización
          </h2>
          <p className="text-slate-600 mt-1">
            Tres pasos guiados o texto libre. La cotización corre contra el
            portal del operador autorizado y devuelve el PDF oficial.
          </p>
        </div>

        <ModeToggle mode={mode} setMode={setMode} disabled={submit.kind === "loading" || submit.kind === "polling"} />

        {mode === "wizard" ? (
          <>
            <StepIndicator current={step} />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 mt-6">
              {step === 1 && (
                <Step1
                  tieneRfc={tieneRfc}
                  setTieneRfc={setTieneRfc}
                  rfc={rfc}
                  setRfc={setRfc}
                  setRfcTouched={setRfcTouched}
                  rfcError={rfcError}
                />
              )}
              {step === 2 && (
                <Step2
                  lineas={lineas}
                  setLineas={setLineas}
                  plan={plan}
                  setPlan={setPlan}
                  equipo={equipo}
                  setEquipo={setEquipo}
                  equiposQty={equiposQty}
                  setEquiposQty={setEquiposQty}
                  equiposCatalog={equiposCatalog}
                  equiposUnavailable={equiposUnavailable}
                  planesCatalog={planesCatalog}
                  planesUnavailable={planesUnavailable}
                  catalogLoading={catalogLoading}
                />
              )}
              {step === 3 && (
                <Step3
                  tieneRfc={tieneRfc}
                  rfc={rfc}
                  lineas={lineas}
                  plan={plan}
                  equipo={equipo}
                  equiposQty={equiposQty}
                  submit={submit}
                  onSubmit={handleSubmit}
                  onRetry={handleRetry}
                />
              )}

              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={back}
                  disabled={
                    step === 1 ||
                    submit.kind === "loading" ||
                    submit.kind === "polling"
                  }
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Atrás
                </button>
                {step < 3 && (
                  <button
                    type="button"
                    onClick={next}
                    disabled={(step === 1 && !step1Valido) || (step === 2 && !step2Valido)}
                    className="px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Siguiente →
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <ExpertoMode
            texto={expertoTexto}
            setTexto={setExpertoTexto}
            loading={expertoLoading}
            parsed={expertoParsed}
            error={expertoError}
            onAnalizar={handleAnalizarExperto}
            // Estado wizard para edición post-parseo:
            tieneRfc={tieneRfc}
            setTieneRfc={setTieneRfc}
            rfc={rfc}
            setRfc={setRfc}
            lineas={lineas}
            setLineas={setLineas}
            plan={plan}
            setPlan={setPlan}
            equipo={equipo}
            setEquipo={setEquipo}
            equiposQty={equiposQty}
            setEquiposQty={setEquiposQty}
            // Submit:
            submit={submit}
            onCotizar={handleCotizarExperto}
            onRetry={handleRetry}
          />
        )}
      </Section>
    </main>
  );
}

/* ---------- Mode toggle ---------- */

function ModeToggle({
  mode,
  setMode,
  disabled,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  disabled: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Modo de cotización"
      className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
    >
      {(["wizard", "experto"] as const).map((m) => (
        <button
          key={m}
          role="tab"
          type="button"
          aria-selected={mode === m}
          disabled={disabled}
          onClick={() => setMode(m)}
          className={[
            "px-4 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
            mode === m
              ? "bg-blue-700 text-white shadow"
              : "text-slate-600 hover:text-slate-900",
          ].join(" ")}
        >
          {m === "wizard" ? "Wizard" : "Experto"}
        </button>
      ))}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const labels: Array<{ n: Step; label: string }> = [
    { n: 1, label: "Cliente" },
    { n: 2, label: "Detalles" },
    { n: 3, label: "Confirmar" },
  ];
  return (
    <ol className="flex items-center gap-2 mt-6" aria-label="Progreso de cotización">
      {labels.map((s, i) => {
        const active = current === s.n;
        const done = current > s.n;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold",
                done
                  ? "bg-blue-700 text-white"
                  : active
                    ? "bg-blue-100 text-blue-700 ring-2 ring-blue-700"
                    : "bg-slate-200 text-slate-500",
              ].join(" ")}
              aria-current={active ? "step" : undefined}
            >
              {s.n}
            </span>
            <span
              className={[
                "text-sm",
                active || done ? "text-slate-900 font-medium" : "text-slate-500",
              ].join(" ")}
            >
              {s.label}
            </span>
            {i < labels.length - 1 && (
              <span className="w-8 h-px bg-slate-300 mx-1" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Steps ---------- */

function Step1(props: {
  tieneRfc: "si" | "no";
  setTieneRfc: (v: "si" | "no") => void;
  rfc: string;
  setRfc: (v: string) => void;
  setRfcTouched: (v: boolean) => void;
  rfcError: string | null;
}) {
  const { tieneRfc, setTieneRfc, rfc, setRfc, setRfcTouched, rfcError } = props;
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Cliente</h3>
      <p className="text-sm text-slate-600 mt-1">
        Indica si el cliente ya existe en el portal del operador.
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-slate-700 mb-2">
          ¿Tienes RFC del cliente?
        </legend>
        <div
          role="radiogroup"
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
        >
          {(["si", "no"] as const).map((opt) => (
            <button
              key={opt}
              role="radio"
              aria-checked={tieneRfc === opt}
              type="button"
              onClick={() => setTieneRfc(opt)}
              className={[
                "px-4 py-1.5 rounded-md text-sm font-medium transition",
                tieneRfc === opt
                  ? "bg-white shadow text-blue-700"
                  : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
            >
              {opt === "si" ? "Sí" : "No"}
            </button>
          ))}
        </div>
      </fieldset>

      {tieneRfc === "si" ? (
        <div className="mt-6">
          <label
            htmlFor="rfc"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            RFC
          </label>
          <input
            id="rfc"
            type="text"
            value={rfc}
            onChange={(e) => setRfc(e.target.value.toUpperCase())}
            onBlur={() => setRfcTouched(true)}
            placeholder="XAXX010101000"
            maxLength={13}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            aria-invalid={Boolean(rfcError)}
            aria-describedby={rfcError ? "rfc-error" : undefined}
            className={[
              "w-full font-mono px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2",
              rfcError
                ? "border-red-300 focus:ring-red-500"
                : "border-slate-300 focus:ring-blue-500",
            ].join(" ")}
          />
          {rfcError && (
            <p id="rfc-error" className="text-sm text-red-600 mt-1">
              {rfcError}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Validamos el formato localmente. La existencia del cliente se
            verifica contra el portal del operador al cotizar.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <strong className="font-semibold">Cotización sin base.</strong>{" "}
            Vamos a generar la propuesta sin asociarla a un cliente del
            portal. Es útil para tantear precios, pero no produce expediente
            oficial. Cuando tengas el RFC, repite la cotización para
            obtener el PDF firmado.
          </p>
        </div>
      )}
    </div>
  );
}

function Step2(props: {
  lineas: number;
  setLineas: (v: number) => void;
  plan: number;
  setPlan: (v: number) => void;
  equipo: string;
  setEquipo: (v: string) => void;
  equiposQty: number;
  setEquiposQty: (v: number) => void;
  equiposCatalog: EquipoCatalogo[];
  equiposUnavailable: boolean;
  planesCatalog: PlanCatalogo[];
  planesUnavailable: boolean;
  catalogLoading: boolean;
}) {
  const {
    lineas,
    setLineas,
    plan,
    setPlan,
    equipo,
    setEquipo,
    equiposQty,
    setEquiposQty,
    equiposCatalog,
    equiposUnavailable,
    planesCatalog,
    planesUnavailable,
    catalogLoading,
  } = props;
  const sinEquipo = equipo === SIN_EQUIPO_LABEL;

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Detalles</h3>
      <p className="text-sm text-slate-600 mt-1">
        Definimos cuántas líneas, plan mensual y equipos.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label htmlFor="lineas" className="block text-sm font-medium text-slate-700 mb-1">
            Líneas
          </label>
          <input
            id="lineas"
            type="number"
            min={1}
            max={500}
            step={1}
            value={lineas}
            onChange={(e) =>
              setLineas(Math.max(1, Math.min(500, Number(e.target.value) || 0)))
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">Entre 1 y 500.</p>
        </div>

        <PlanPicker
          plan={plan}
          setPlan={setPlan}
          planes={planesCatalog}
          unavailable={planesUnavailable}
          loading={catalogLoading}
        />

        <EquipoAutocomplete
          equipo={equipo}
          setEquipo={setEquipo}
          equipos={equiposCatalog}
          unavailable={equiposUnavailable}
          loading={catalogLoading}
        />

        <div>
          <label
            htmlFor="equipos_qty"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Cantidad de equipos
          </label>
          <input
            id="equipos_qty"
            type="number"
            min={0}
            max={lineas}
            step={1}
            value={equiposQty}
            disabled={sinEquipo}
            onChange={(e) =>
              setEquiposQty(Math.max(0, Math.min(lineas, Number(e.target.value) || 0)))
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          />
          <p className="text-xs text-slate-500 mt-1">
            {sinEquipo
              ? "No aplica cuando seleccionas Sin equipo."
              : `Máximo ${lineas} (igual al número de líneas).`}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Equipo autocomplete (searchable dropdown sin libs) ---------- */

function EquipoAutocomplete({
  equipo,
  setEquipo,
  equipos,
  unavailable,
  loading,
}: {
  equipo: string;
  setEquipo: (v: string) => void;
  equipos: EquipoCatalogo[];
  unavailable: boolean;
  loading: boolean;
}) {
  const [query, setQuery] = useState(equipo === SIN_EQUIPO_LABEL ? "" : equipo);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mantener `query` sincronizado cuando `equipo` cambia desde fuera
  // (e.g. modo experto auto-llena el equipo).
  useEffect(() => {
    if (equipo === SIN_EQUIPO_LABEL) {
      setQuery("");
    } else if (equipo !== query) {
      setQuery(equipo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipo]);

  // Cerrar al click fuera.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = equipos;
    if (!q) return list.slice(0, 50);
    return list
      .filter((eq) => {
        const hay = `${eq.label} ${eq.marca || ""} ${eq.modelo || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [query, equipos]);

  function selectEquipo(label: string) {
    setEquipo(label);
    setQuery(label === SIN_EQUIPO_LABEL ? "" : label);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="equipo" className="block text-sm font-medium text-slate-700 mb-1">
        Equipo
      </label>
      <input
        id="equipo"
        type="text"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={loading ? "Cargando catálogo…" : "Busca: iPhone, Samsung, Motorola…"}
        autoComplete="off"
        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-64 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg"
        >
          <li
            role="option"
            aria-selected={equipo === SIN_EQUIPO_LABEL}
            onMouseDown={(e) => {
              e.preventDefault();
              selectEquipo(SIN_EQUIPO_LABEL);
            }}
            className={[
              "px-3 py-2 text-sm cursor-pointer hover:bg-slate-100",
              equipo === SIN_EQUIPO_LABEL ? "bg-blue-50 text-blue-700" : "text-slate-700",
            ].join(" ")}
          >
            Sin equipo
          </li>
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500 italic">
              Sin resultados. Puedes escribir el modelo a mano.
            </li>
          )}
          {filtered.map((eq) => (
            <li
              key={eq.id || eq.label}
              role="option"
              aria-selected={equipo === eq.label}
              onMouseDown={(e) => {
                e.preventDefault();
                selectEquipo(eq.label);
              }}
              className={[
                "px-3 py-2 text-sm cursor-pointer hover:bg-slate-100",
                equipo === eq.label ? "bg-blue-50 text-blue-700" : "text-slate-700",
              ].join(" ")}
            >
              <div className="font-medium">{eq.label}</div>
              {(eq.marca || eq.capacidad) && (
                <div className="text-xs text-slate-500">
                  {[eq.marca, eq.capacidad].filter(Boolean).join(" · ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {unavailable && !loading && (
        <p className="text-xs text-amber-700 mt-1">
          Catálogo completo no disponible. Mostramos lista corta — puedes
          escribir el modelo a mano.
        </p>
      )}
    </div>
  );
}

/* ---------- Plan picker agrupado (con fallback a número) ---------- */

function PlanPicker({
  plan,
  setPlan,
  planes,
  unavailable,
  loading,
}: {
  plan: number;
  setPlan: (v: number) => void;
  planes: PlanCatalogo[];
  unavailable: boolean;
  loading: boolean;
}) {
  // Filtros progresivos: grupo → modalidad → plazo → plan específico.
  const [grupo, setGrupo] = useState<string>("");
  const [modalidad, setModalidad] = useState<string>("");
  const [plazo, setPlazo] = useState<string>("");

  const grupos = useMemo(() => {
    return Array.from(
      new Set(planes.map((p) => p.grupo).filter((g): g is string => Boolean(g))),
    ).sort();
  }, [planes]);

  const modalidades = useMemo(() => {
    return Array.from(
      new Set(
        planes
          .filter((p) => !grupo || p.grupo === grupo)
          .map((p) => p.modalidad)
          .filter((m): m is string => Boolean(m)),
      ),
    ).sort();
  }, [planes, grupo]);

  const plazos = useMemo(() => {
    return Array.from(
      new Set(
        planes
          .filter((p) => !grupo || p.grupo === grupo)
          .filter((p) => !modalidad || p.modalidad === modalidad)
          .map((p) => p.plazo)
          .filter((pl): pl is number => typeof pl === "number"),
      ),
    ).sort((a, b) => a - b);
  }, [planes, grupo, modalidad]);

  const planesFiltrados = useMemo(() => {
    return planes
      .filter((p) => !grupo || p.grupo === grupo)
      .filter((p) => !modalidad || p.modalidad === modalidad)
      .filter((p) => !plazo || String(p.plazo) === plazo)
      .sort((a, b) => a.precio - b.precio);
  }, [planes, grupo, modalidad, plazo]);

  // Si el catálogo no está disponible o aún cargando, mostramos input numérico
  // (modo legado, mismo comportamiento que antes).
  if (loading || unavailable || planes.length === 0) {
    return (
      <div>
        <label htmlFor="plan" className="block text-sm font-medium text-slate-700 mb-1">
          Plan mensual por línea (MXN)
        </label>
        <input
          id="plan"
          type="number"
          min={100}
          max={5000}
          step={1}
          value={plan}
          onChange={(e) =>
            setPlan(Math.max(100, Math.min(5000, Number(e.target.value) || 0)))
          }
          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-500 mt-1">
          {loading
            ? "Cargando catálogo de planes…"
            : unavailable
              ? "Catálogo de planes no disponible — escribe el monto."
              : "Entre 100 y 5000 MXN."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Plan
      </label>
      <div className="grid grid-cols-3 gap-2">
        <select
          value={grupo}
          onChange={(e) => {
            setGrupo(e.target.value);
            setModalidad("");
            setPlazo("");
          }}
          className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Grupo"
        >
          <option value="">Grupo</option>
          {grupos.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={modalidad}
          onChange={(e) => {
            setModalidad(e.target.value);
            setPlazo("");
          }}
          className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Modalidad"
        >
          <option value="">Modalidad</option>
          {modalidades.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={plazo}
          onChange={(e) => setPlazo(e.target.value)}
          className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Plazo"
        >
          <option value="">Plazo</option>
          {plazos.map((p) => (
            <option key={p} value={String(p)}>
              {p} meses
            </option>
          ))}
        </select>
      </div>
      <select
        value={String(plan)}
        onChange={(e) => setPlan(Number(e.target.value) || plan)}
        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Plan específico"
      >
        <option value="">Selecciona plan…</option>
        {planesFiltrados.map((p) => (
          <option key={p.id || `${p.label}-${p.precio}`} value={String(p.precio)}>
            {p.label} — ${p.precio.toLocaleString("es-MX")} MXN
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500 mt-1">
        Filtra por grupo/modalidad/plazo y elige el plan exacto.
      </p>
    </div>
  );
}

function Step3(props: {
  tieneRfc: "si" | "no";
  rfc: string;
  lineas: number;
  plan: number;
  equipo: string;
  equiposQty: number;
  submit: SubmitState;
  onSubmit: () => void;
  onRetry: () => void;
}) {
  const { tieneRfc, rfc, lineas, plan, equipo, equiposQty, submit, onSubmit, onRetry } =
    props;

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Confirmación</h3>
      <p className="text-sm text-slate-600 mt-1">
        Revisa los datos antes de enviar al portal del operador.
      </p>

      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <ResumenRow
          label="Cliente"
          value={tieneRfc === "si" ? rfc : "Cotización sin base"}
          mono={tieneRfc === "si"}
        />
        <ResumenRow label="Líneas" value={lineas.toString()} />
        <ResumenRow
          label="Plan mensual por línea"
          value={`$${plan.toLocaleString("es-MX")} MXN`}
        />
        <ResumenRow label="Equipo" value={equipo} />
        <ResumenRow
          label="Cantidad de equipos"
          value={equipo === SIN_EQUIPO_LABEL ? "—" : equiposQty.toString()}
        />
      </dl>

      <SubmitArea submit={submit} onSubmit={onSubmit} onRetry={onRetry} />
    </div>
  );
}

/* ---------- Modo experto ---------- */

function ExpertoMode(props: {
  texto: string;
  setTexto: (v: string) => void;
  loading: boolean;
  parsed: ExpertoResponse | null;
  error: string | null;
  onAnalizar: () => void;
  // Estado wizard editable post-parseo:
  tieneRfc: "si" | "no";
  setTieneRfc: (v: "si" | "no") => void;
  rfc: string;
  setRfc: (v: string) => void;
  lineas: number;
  setLineas: (v: number) => void;
  plan: number;
  setPlan: (v: number) => void;
  equipo: string;
  setEquipo: (v: string) => void;
  equiposQty: number;
  setEquiposQty: (v: number) => void;
  // Submit
  submit: SubmitState;
  onCotizar: () => void;
  onRetry: () => void;
}) {
  const {
    texto,
    setTexto,
    loading,
    parsed,
    error,
    onAnalizar,
    tieneRfc,
    setTieneRfc,
    rfc,
    setRfc,
    lineas,
    setLineas,
    plan,
    setPlan,
    equipo,
    setEquipo,
    equiposQty,
    setEquiposQty,
    submit,
    onCotizar,
    onRetry,
  } = props;

  const lowConfidence =
    parsed && typeof parsed.confidence === "number" && parsed.confidence < 0.6;
  const missing = parsed?.missing_fields ?? [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 mt-6">
      <h3 className="text-lg font-semibold text-slate-900">
        Cotización por texto libre
      </h3>
      <p className="text-sm text-slate-600 mt-1">
        Describe la cotización en una oración. Claude la interpreta y te muestra
        los campos para confirmar.
      </p>

      <label htmlFor="experto-texto" className="sr-only">
        Texto experto
      </label>
      <textarea
        id="experto-texto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ejemplo: 5 iPhone 15 con plan Empresa 800 a 24 meses para ASE1803062B7"
        rows={4}
        maxLength={2000}
        disabled={loading}
        className="mt-4 w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-slate-500">
          {texto.length}/2000 caracteres.
        </p>
        <button
          type="button"
          onClick={onAnalizar}
          disabled={loading || !texto.trim()}
          className="px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition inline-flex items-center gap-2"
        >
          {loading && (
            <span
              className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
              aria-hidden="true"
            />
          )}
          {loading ? "Analizando…" : "Analizar"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {parsed && !error && (
        <div className="mt-6 border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-base font-semibold text-slate-900">
              Esto es lo que entendí
            </h4>
            {typeof parsed.confidence === "number" && (
              <span
                className={[
                  "text-xs font-mono px-2 py-0.5 rounded",
                  lowConfidence
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800",
                ].join(" ")}
              >
                confidence {Math.round(parsed.confidence * 100)}%
              </span>
            )}
          </div>

          {parsed.notas && (
            <p className="text-sm text-slate-600 mt-2 italic">{parsed.notas}</p>
          )}

          {lowConfidence && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <strong className="font-semibold">Confianza baja.</strong> Verifica
              cada campo antes de cotizar.
            </div>
          )}

          {missing.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <strong className="font-semibold">Falta:</strong> {missing.join(", ")}.
              Llena los campos abajo para continuar.
            </div>
          )}

          {/* Tarjeta de confirmación editable: usamos los mismos states del wizard. */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                RFC
              </label>
              <div className="flex gap-2">
                <select
                  value={tieneRfc}
                  onChange={(e) => setTieneRfc(e.target.value as "si" | "no")}
                  className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  aria-label="¿Tiene RFC?"
                >
                  <option value="si">Sí</option>
                  <option value="no">Sin RFC</option>
                </select>
                <input
                  type="text"
                  value={rfc}
                  onChange={(e) => setRfc(e.target.value.toUpperCase())}
                  disabled={tieneRfc === "no"}
                  placeholder="XAXX010101000"
                  maxLength={13}
                  className="flex-1 font-mono px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Líneas
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={lineas}
                onChange={(e) =>
                  setLineas(Math.max(1, Math.min(500, Number(e.target.value) || 0)))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Plan mensual (MXN)
              </label>
              <input
                type="number"
                min={100}
                max={5000}
                value={plan}
                onChange={(e) =>
                  setPlan(Math.max(100, Math.min(5000, Number(e.target.value) || 0)))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Equipo
              </label>
              <input
                type="text"
                value={equipo}
                onChange={(e) => setEquipo(e.target.value)}
                placeholder="iPhone 15, Sin equipo, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cantidad de equipos
              </label>
              <input
                type="number"
                min={0}
                max={lineas}
                value={equiposQty}
                disabled={equipo === SIN_EQUIPO_LABEL}
                onChange={(e) =>
                  setEquiposQty(Math.max(0, Math.min(lineas, Number(e.target.value) || 0)))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            {(parsed.plazo || parsed.modalidad || parsed.grupo) && (
              <div className="md:col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                <strong className="font-semibold text-slate-700">Detectado:</strong>{" "}
                {[
                  parsed.grupo && `grupo ${parsed.grupo}`,
                  parsed.modalidad && `modalidad ${parsed.modalidad}`,
                  parsed.plazo && `plazo ${parsed.plazo} meses`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                . Ajusta los campos arriba si es necesario.
              </div>
            )}
          </div>

          <SubmitArea submit={submit} onSubmit={onCotizar} onRetry={onRetry} />
        </div>
      )}
    </div>
  );
}

/* ---------- Submit area compartida ---------- */

function SubmitArea({
  submit,
  onSubmit,
  onRetry,
}: {
  submit: SubmitState;
  onSubmit: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="mt-8">
      {submit.kind === "idle" && (
        <button
          type="button"
          onClick={onSubmit}
          className="w-full md:w-auto px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 transition"
        >
          Cotizar
        </button>
      )}
      {submit.kind === "loading" && (
        <button
          type="button"
          disabled
          className="w-full md:w-auto px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg opacity-70 cursor-wait inline-flex items-center gap-3"
        >
          <span
            className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
            aria-hidden="true"
          />
          Enviando solicitud…
        </button>
      )}
      {submit.kind === "polling" && (
        <div
          className="rounded-xl border border-blue-200 bg-blue-50 p-5"
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
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
          </div>
          {!submit.pdfUrl && (
            <p className="mt-3 text-sm text-emerald-800">
              El PDF aún se está generando. Revisa el historial en unos segundos.
            </p>
          )}
        </div>
      )}
      {submit.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-red-900 font-semibold">No pudimos cotizar.</p>
          <p className="text-sm text-red-800 mt-1">{submit.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 px-4 py-2 bg-red-700 text-white text-sm font-semibold rounded-lg hover:bg-red-800 transition"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}

function ResumenRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd
        className={[
          "mt-1 text-slate-900",
          mono ? "font-mono" : "font-medium",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
