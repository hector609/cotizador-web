"use client";

/**
 * /dashboard/optimizar — sugiere palancas óptimas con Claude para llegar a
 * un AB target sin romper la regla AB 25%.
 *
 * Flujo:
 *   1. Usuario llena un form con perfil del cliente (líneas, plan, plazo,
 *      grupo, modalidad, equipo, AB target).
 *   2. POST /api/optimizar → backend bot → Claude con tool-use iterativo.
 *      Tarda 5-15s (se muestra spinner con texto explicativo).
 *   3. Resultado: tarjeta con 5 palancas + rentabilidad simulada + razonamiento.
 *   4. Botón "Aplicar y cotizar" → guarda las palancas + perfil en
 *      sessionStorage["optimizar:palancas"] y redirige a /dashboard/cotizar.
 *      ChatInterface lee esa entrada al montar (una sola vez), arma un
 *      prompt verboso del tipo "Cotiza con estas palancas aplicadas: ..."
 *      y lo pre-llena en el composer. El vendedor revisa y presiona Enter
 *      para enviar al agente Claude, que aplica las palancas en el portal
 *      Telcel vía el flujo conversacional.
 *
 * Antes el botón solo redirigía con `from=optimizar` y las palancas se
 * perdían (el comentario decía "las palancas no viajan al endpoint actual").
 * Ahora viajan como parte del mensaje del chat — el endpoint /api/chat/cotizar
 * extrae los parámetros del texto natural igual que cualquier otra request.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { RFC_REGEX } from "@/types/cotizacion";
import { DashboardNav } from "../_nav";

// ────────────────────────────────────────────────────────────────────
// Tipos del response del backend
// ────────────────────────────────────────────────────────────────────

interface OptimizarPalancas {
  aportacion_voluntaria: number;
  meses_gratis: number;
  descuento_renta_pct: number;
  beneficio_megas_pct: number;
  tasa_negociada_pct: number;
}

interface OptimizarResponse {
  palancas: OptimizarPalancas;
  rentabilidad_simulada: number;
  ab_logrado: number;
  alcanza_target: boolean;
  viola_ab25: boolean;
  razonamiento: string;
  baseline_sintetico: {
    renta_per_linea: number;
    precio_equipo: number;
    num_lineas: number;
    plazo_meses: number;
  };
  unavailable?: boolean;
  error?: string;
}

interface PlanOption {
  label: string;
  value: string;
  precio?: number;
  grupo?: string;
  modalidad?: string;
  plazo?: number;
}

interface EquipoOption {
  label: string;
  marca?: string;
  modelo?: string;
}

// Fallback pequeño y representativo si el catálogo aún no está disponible.
const EQUIPOS_FALLBACK: EquipoOption[] = [
  { label: "iPhone 15", marca: "Apple", modelo: "iPhone 15" },
  { label: "iPhone 15 Pro", marca: "Apple", modelo: "iPhone 15 Pro" },
  { label: "Samsung Galaxy S24", marca: "Samsung", modelo: "Galaxy S24" },
  { label: "Motorola Edge 50", marca: "Motorola", modelo: "Edge 50" },
];

const PLAZOS = [12, 18, 24, 36] as const;
const GRUPOS = ["Empresa", "Corporativo"] as const;
const MODALIDADES = ["CPP", "AA", "MPP"] as const;

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: OptimizarResponse }
  | { kind: "error"; msg: string };

// ────────────────────────────────────────────────────────────────────

export default function OptimizarPage() {
  const router = useRouter();

  // Form state
  const [rfc, setRfc] = useState("");
  const [lineas, setLineas] = useState<number>(5);
  const [plan, setPlan] = useState<string>("TELCEL EMPRESA BASE");
  const [plazo, setPlazo] = useState<number>(24);
  const [grupo, setGrupo] = useState<string>("Empresa");
  const [modalidad, setModalidad] = useState<string>("CPP");
  const [equipoLabel, setEquipoLabel] = useState<string>("iPhone 15");
  const [equiposQty, setEquiposQty] = useState<number>(5);
  const [abTarget, setAbTarget] = useState<number>(25);
  const [preferencias, setPreferencias] = useState<string>("");

  // Catálogos (best-effort — usamos fallback si no se cargan)
  const [equiposCatalog, setEquiposCatalog] = useState<EquipoOption[]>(EQUIPOS_FALLBACK);
  const [planesCatalog, setPlanesCatalog] = useState<PlanOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Submit state
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  // Cargar catálogos al montar.
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
            equipos?: EquipoOption[];
            unavailable?: boolean;
          };
          if (!data.unavailable && Array.isArray(data.equipos) && data.equipos.length) {
            setEquiposCatalog(data.equipos);
          }
        }
        if (plRes.ok) {
          const data = (await plRes.json()) as {
            planes?: PlanOption[];
            unavailable?: boolean;
          };
          if (!data.unavailable && Array.isArray(data.planes) && data.planes.length) {
            setPlanesCatalog(data.planes);
          }
        }
      } catch {
        // Silencio — usamos fallbacks. El form sigue siendo usable.
      } finally {
        if (alive) setCatalogLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Mantener equipos_qty <= lineas.
  useEffect(() => {
    if (equiposQty > lineas) setEquiposQty(lineas);
  }, [lineas, equiposQty]);

  // Validaciones
  const rfcValido = useMemo(() => !rfc.trim() || RFC_REGEX.test(rfc.trim()), [rfc]);
  const formValido =
    rfcValido &&
    Number.isInteger(lineas) &&
    lineas >= 1 &&
    lineas <= 500 &&
    plan.trim().length > 0 &&
    PLAZOS.includes(plazo as 12 | 18 | 24 | 36) &&
    equipoLabel.trim().length > 0 &&
    equiposQty >= 0 &&
    equiposQty <= lineas &&
    abTarget >= 5 &&
    abTarget <= 50;

  // Equipo seleccionado (resolvemos a {marca, modelo} si está en el catálogo).
  const equipoSeleccionado = useMemo(() => {
    const fromCatalog = equiposCatalog.find((e) => e.label === equipoLabel);
    if (fromCatalog?.modelo) {
      return { marca: fromCatalog.marca || "", modelo: fromCatalog.modelo };
    }
    return { marca: "", modelo: equipoLabel };
  }, [equipoLabel, equiposCatalog]);

  async function handleOptimizar() {
    if (!formValido) return;
    setSubmit({ kind: "loading" });

    try {
      const res = await fetch("/api/optimizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfc: rfc.trim().toUpperCase() || undefined,
          lineas,
          plan,
          plazo,
          grupo,
          modalidad,
          equipo: equipoSeleccionado,
          equipos_qty: equiposQty,
          ab_target: abTarget,
          preferencias: preferencias.trim() || undefined,
        }),
      });

      const data = (await res.json()) as OptimizarResponse & { error?: string };
      if (!res.ok) {
        setSubmit({
          kind: "error",
          msg: data?.error || `Error HTTP ${res.status}`,
        });
        return;
      }
      if (data.unavailable) {
        setSubmit({
          kind: "error",
          msg: data.error || "Optimizador no disponible.",
        });
        return;
      }
      setSubmit({ kind: "ok", data });
    } catch (e) {
      console.error("[optimizar] fetch error", e);
      setSubmit({
        kind: "error",
        msg: "Error de red al llamar al optimizador.",
      });
    }
  }

  function handleAplicarYCotizar() {
    if (submit.kind !== "ok") return;
    // Persistimos las palancas en sessionStorage para que /dashboard/cotizar
    // pueda leerlas (no las pasamos por query params porque son objeto y
    // exceden la longitud cómoda de URL).
    try {
      sessionStorage.setItem(
        "optimizar:palancas",
        JSON.stringify({
          rfc: rfc.trim().toUpperCase() || "",
          lineas,
          plan,
          plazo,
          equipo: equipoLabel,
          equipos_qty: equiposQty,
          palancas: submit.data.palancas,
          rentabilidad_simulada: submit.data.rentabilidad_simulada,
          razonamiento: submit.data.razonamiento,
          createdAt: Date.now(),
        }),
      );
    } catch {
      // sessionStorage puede fallar en modo privado — seguimos sin payload.
    }
    const params = new URLSearchParams({
      rfc: rfc.trim().toUpperCase() || "",
      lineas: String(lineas),
      plazo: String(plazo),
      from: "optimizar",
    });
    router.push(`/dashboard/cotizar?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="optimizar" />

      <Section bg="white" spacing="sm" width="narrow">
        <div>
          <div className="mb-6">
            <Badge variant="primary">Beta</Badge>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">
              Encuentra la mejor combinación de palancas
            </h2>
            <p className="mt-1 text-slate-600">
              Claude busca la combinación óptima (aportación, meses gratis,
              descuento, megas, tasa) para llegar a tu AB target sin violar la
              regla AB 25%. Tarda 5-15 segundos.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleOptimizar();
            }}
            className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
          >
            {/* RFC opcional */}
            <Field label="RFC del cliente (opcional)" hint="Solo lo usamos como contexto.">
              <input
                type="text"
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                placeholder="ASE1803062B7"
                className={inputCls}
                maxLength={13}
              />
              {rfc.trim() && !rfcValido && (
                <p className="mt-1 text-xs text-red-600">
                  RFC inválido. Formato: XAXX010101XXX.
                </p>
              )}
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Número de líneas">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={lineas}
                  onChange={(e) => setLineas(Math.max(1, Number(e.target.value) || 1))}
                  className={inputCls}
                />
              </Field>
              <Field label="Plazo (meses)">
                <select
                  value={plazo}
                  onChange={(e) => setPlazo(Number(e.target.value))}
                  className={inputCls}
                >
                  {PLAZOS.map((p) => (
                    <option key={p} value={p}>
                      {p} meses
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Grupo">
                <select
                  value={grupo}
                  onChange={(e) => setGrupo(e.target.value)}
                  className={inputCls}
                >
                  {GRUPOS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Modalidad">
                <select
                  value={modalidad}
                  onChange={(e) => setModalidad(e.target.value)}
                  className={inputCls}
                >
                  {MODALIDADES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field
              label="Plan"
              hint={
                catalogLoading
                  ? "Cargando catálogo…"
                  : planesCatalog.length === 0
                  ? "Catálogo no disponible — escribe el nombre del plan."
                  : "Selecciona del catálogo o escribe."
              }
            >
              {planesCatalog.length > 0 ? (
                <input
                  list="planes-list"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className={inputCls}
                  placeholder="TELCEL EMPRESA BASE"
                />
              ) : (
                <input
                  type="text"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className={inputCls}
                  placeholder="TELCEL EMPRESA BASE"
                />
              )}
              {planesCatalog.length > 0 && (
                <datalist id="planes-list">
                  {planesCatalog.slice(0, 200).map((p, i) => (
                    <option key={i} value={p.label} />
                  ))}
                </datalist>
              )}
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Field label="Equipo">
                  <input
                    list="equipos-list"
                    value={equipoLabel}
                    onChange={(e) => setEquipoLabel(e.target.value)}
                    className={inputCls}
                    placeholder="iPhone 15"
                  />
                  <datalist id="equipos-list">
                    {equiposCatalog.slice(0, 200).map((eq, i) => (
                      <option key={i} value={eq.label} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <Field label="Cantidad de equipos">
                <input
                  type="number"
                  min={0}
                  max={lineas}
                  value={equiposQty}
                  onChange={(e) => setEquiposQty(Math.max(0, Number(e.target.value) || 0))}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* AB target slider */}
            <Field
              label={`AB target: ${abTarget}%`}
              hint="Por defecto 25% (regla AB 25%). Bajar implica más palancas y menos rentabilidad."
            >
              <input
                type="range"
                min={15}
                max={35}
                step={1}
                value={abTarget}
                onChange={(e) => setAbTarget(Number(e.target.value))}
                className="w-full accent-blue-700"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>15%</span>
                <span>25% (estándar)</span>
                <span>35%</span>
              </div>
            </Field>

            <Field label="Preferencias (opcional)" hint="Ej: 'sin aportación', 'prefer meses gratis'.">
              <input
                type="text"
                value={preferencias}
                onChange={(e) => setPreferencias(e.target.value)}
                className={inputCls}
                placeholder="sin aportación"
                maxLength={300}
              />
            </Field>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!formValido || submit.kind === "loading"}
                className={btnPrimary}
              >
                {submit.kind === "loading" ? "Optimizando con Claude…" : "Optimizar"}
              </button>
            </div>
          </form>

          {/* Loading hint */}
          {submit.kind === "loading" && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <span className="font-medium">Pensando…</span> Claude está
              probando combinaciones de palancas contra el simulador local.
              Esto suele tardar 5-15 segundos.
            </div>
          )}

          {/* Error */}
          {submit.kind === "error" && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
              <span className="font-medium">No pudimos optimizar:</span>{" "}
              {submit.msg}
            </div>
          )}

          {/* Resultado */}
          {submit.kind === "ok" && (
            <ResultadoCard
              data={submit.data}
              abTarget={abTarget}
              onAplicar={handleAplicarYCotizar}
            />
          )}
        </div>
      </Section>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────

function ResultadoCard({
  data,
  abTarget,
  onAplicar,
}: {
  data: OptimizarResponse;
  abTarget: number;
  onAplicar: () => void;
}) {
  const target_ok = data.alcanza_target;
  const violaAb25 = data.viola_ab25;

  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Propuesta de Claude
          </h3>
          <p className="text-sm text-slate-600">
            Para AB target {abTarget}% (rentabilidad ≥ {100 - abTarget}%).
          </p>
        </div>
        <div className="flex gap-2">
          {target_ok ? (
            <Badge variant="primary">Alcanza target</Badge>
          ) : (
            <Badge variant="warning">No llega al target</Badge>
          )}
          {violaAb25 && <Badge variant="warning">Viola AB 25%</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Metric
          label="Aportación"
          value={`$${data.palancas.aportacion_voluntaria.toLocaleString("es-MX")}`}
        />
        <Metric
          label="Meses gratis"
          value={`${data.palancas.meses_gratis}`}
        />
        <Metric
          label="Descuento renta"
          value={`${data.palancas.descuento_renta_pct}%`}
        />
        <Metric
          label="Beneficio megas"
          value={`${data.palancas.beneficio_megas_pct}%`}
        />
        <Metric
          label="Tasa negociada"
          value={`${data.palancas.tasa_negociada_pct}%`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-500 uppercase tracking-wide">
            Rentabilidad simulada
          </div>
          <div className="text-xl font-bold text-slate-900">
            {data.rentabilidad_simulada.toFixed(2)}%
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-500 uppercase tracking-wide">
            AB logrado
          </div>
          <div className="text-xl font-bold text-slate-900">
            {data.ab_logrado.toFixed(2)}%
          </div>
        </div>
      </div>

      {data.razonamiento && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-slate-800 mb-5">
          <div className="font-semibold text-blue-900 mb-1">Razonamiento</div>
          <p className="whitespace-pre-wrap">{data.razonamiento}</p>
        </div>
      )}

      <div className="text-xs text-slate-500 mb-4">
        Esto es la simulación local — los números reales los confirma Telcel
        cuando se corra la cotización con estas palancas aplicadas. Al pulsar
        “Aplicar y cotizar” te llevamos al chat con el prompt listo: solo
        revisa y presiona Enter para enviar al agente.
      </div>

      <div className="flex gap-3 flex-wrap">
        <button onClick={onAplicar} className={btnPrimary}>
          Aplicar y cotizar
        </button>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-base font-bold text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const btnPrimary =
  "px-5 py-2.5 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition";
