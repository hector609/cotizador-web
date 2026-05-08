"use client";

/**
 * /dashboard/cotizar — formulario web multi-paso para crear una cotización.
 *
 * Flujo: Cliente → Detalles → Confirmación.
 * Estado mantenido con `useState` (sin react-hook-form) por simplicidad: la
 * superficie del form es chica (≤ 6 campos) y no justifica una dependencia.
 *
 * Auth: el wrapper /api/cotizaciones (Route Handler) valida la cookie de
 * sesión. Aquí no necesitamos `getSession()` server-side porque la página
 * es Client Component; si la sesión está vencida el POST devolverá 401 y
 * mostramos el error inline para no perder el form a medio llenar.
 *
 * El RFC opcional viene del query param `?rfc=...` cuando el DAT llega
 * desde /dashboard/clientes ("Cotizar para este cliente"). NO confiar en
 * ese valor para autorizar nada — el backend re-verifica contra el
 * tenant_id derivado del HMAC.
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

type EquipoOption = "iPhone 15" | "Samsung Galaxy S24" | "Motorola Edge 50" | "Sin equipo";
const EQUIPO_OPTIONS: EquipoOption[] = [
  "iPhone 15",
  "Samsung Galaxy S24",
  "Motorola Edge 50",
  "Sin equipo",
];

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

  // Step 1
  const [tieneRfc, setTieneRfc] = useState<"si" | "no">("si");
  const [rfc, setRfc] = useState<string>(() => (params.get("rfc") || "").toUpperCase());
  const [rfcTouched, setRfcTouched] = useState(false);

  // Step 2
  const [lineas, setLineas] = useState<number>(1);
  const [plan, setPlan] = useState<number>(500);
  const [equipo, setEquipo] = useState<EquipoOption>("Sin equipo");
  const [equiposQty, setEquiposQty] = useState<number>(0);

  // Wizard
  const [step, setStep] = useState<Step>(1);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

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
    if (equipo === "Sin equipo" && equiposQty !== 0) setEquiposQty(0);
  }, [equipo, equiposQty]);

  // Si líneas baja por debajo de equiposQty, recortar para mantener invariante.
  useEffect(() => {
    if (equiposQty > lineas) setEquiposQty(lineas);
  }, [lineas, equiposQty]);

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
    (equipo !== "Sin equipo" || equiposQty === 0);

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

  async function handleSubmit() {
    if (submit.kind === "loading" || submit.kind === "polling") return; // idempotencia visual
    setSubmit({ kind: "loading" });

    const payload: CrearCotizacionInput = {
      rfc: tieneRfc === "si" ? rfc : undefined,
      lineas,
      plan,
      equipo: equipo === "Sin equipo" ? undefined : equipo,
      equipos_qty: equiposQty,
    };

    try {
      const res = await fetch("/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // No mandamos credentials: la cookie es same-origin httpOnly y se
        // incluye automáticamente.
      });

      if (res.status === 401) {
        // Sesión expirada — redirigir a login conservando intent.
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

  function handleRetry() {
    clearPolling();
    setSubmit({ kind: "idle" });
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
            Tres pasos. La cotización corre contra el portal del operador
            autorizado y devuelve el PDF oficial.
          </p>
        </div>

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
      </Section>
    </main>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const labels: Array<{ n: Step; label: string }> = [
    { n: 1, label: "Cliente" },
    { n: 2, label: "Detalles" },
    { n: 3, label: "Confirmar" },
  ];
  return (
    <ol className="flex items-center gap-2" aria-label="Progreso de cotización">
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
  equipo: EquipoOption;
  setEquipo: (v: EquipoOption) => void;
  equiposQty: number;
  setEquiposQty: (v: number) => void;
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
  } = props;
  const sinEquipo = equipo === "Sin equipo";
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
          <p className="text-xs text-slate-500 mt-1">Entre 100 y 5000 MXN.</p>
        </div>

        <div>
          <label htmlFor="equipo" className="block text-sm font-medium text-slate-700 mb-1">
            Equipo
          </label>
          <select
            id="equipo"
            value={equipo}
            onChange={(e) => setEquipo(e.target.value as EquipoOption)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {EQUIPO_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {/* TODO: cuando el bot exponga el catálogo real, reemplazar con un fetch dinámico. */}
        </div>

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

function Step3(props: {
  tieneRfc: "si" | "no";
  rfc: string;
  lineas: number;
  plan: number;
  equipo: EquipoOption;
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
          value={equipo === "Sin equipo" ? "—" : equiposQty.toString()}
        />
      </dl>

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
            <p className="text-emerald-900 font-semibold">
              Cotización lista.
            </p>
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
