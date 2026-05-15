"use client";

/**
 * /dashboard/optimizar — sugiere palancas óptimas con Claude para llegar a
 * un AB target sin romper la regla AB 25%.
 *
 * REDISEÑO LUMINA Light Premium (2026-05-13):
 *   - Sidebar light unificado (reemplaza el viejo DashboardNav).
 *   - Layout 2 columnas: LEFT cards-palanca (≈40%), RIGHT preview impacto (≈60%).
 *   - Cada palanca en su propio card con icon colorful + descripción + slider/select.
 *   - Preview live (sin red): simulador local recalcula A/B/monto/ahorro al mover
 *     palancas — antes el preview sólo aparecía DESPUÉS del fetch /api/optimizar.
 *   - Recharts AreaChart antes/después (cyan vs gris), NumberFlow en KPIs.
 *   - Pills rounded-full indigo→cyan en CTAs, framer-motion stagger fade-up.
 *   - Empty state cuando todas las palancas están en cero.
 *
 * Flujo backend (intacto):
 *   1. Form de perfil (RFC, líneas, plan, plazo, grupo, modalidad, equipo, AB
 *      target). El usuario también puede ajustar palancas manualmente — el
 *      simulador local le da feedback inmediato.
 *   2. POST /api/optimizar → backend bot → Claude con tool-use iterativo.
 *      Tarda 5-15s. Claude propone una combinación de palancas que el panel
 *      derecho carga directamente como "Propuesta de Claude".
 *   3. Botón "Aplicar y cotizar" → guarda las palancas + perfil en
 *      sessionStorage["optimizar:palancas"] y redirige a /dashboard/cotizar.
 *      ChatInterface lee esa entrada al montar y arma el prompt verboso para
 *      el agente conversacional.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Sparkles,
  PiggyBank,
  Gift,
  Percent,
  Wifi,
  TrendingDown,
  User,
  Smartphone,
  ChevronDown,
  X,
  Loader2,
  AlertTriangle,
  Target,
  Wand2,
  ArrowRight,
} from "lucide-react";
import { Sidebar } from "@/components/admin/Sidebar";
import { RFC_REGEX } from "@/types/cotizacion";

// ────────────────────────────────────────────────────────────────────
// Tipos
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

interface Cliente {
  rfc: string;
  nombre: string;
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
const BENEFICIO_MEGAS_OPCIONES = [0, 25, 50, 75, 100] as const;
const TASA_NEGOCIADA_OPCIONES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: OptimizarResponse }
  | { kind: "error"; msg: string };

// Estado de las palancas que el usuario ajusta manualmente (para preview live).
interface PalancasManual {
  aportacion_voluntaria: number;
  meses_gratis: number;
  descuento_renta_pct: number;
  beneficio_megas_pct: number;
  tasa_negociada_pct: number;
}

const PALANCAS_DEFAULT: PalancasManual = {
  aportacion_voluntaria: 0,
  meses_gratis: 0,
  descuento_renta_pct: 0,
  beneficio_megas_pct: 0,
  tasa_negociada_pct: 0,
};

// ────────────────────────────────────────────────────────────────────
// Simulador local (best-effort): refleja la lógica que Claude usa contra el
// simulador del bot. NO es la verdad — sólo da feedback inmediato al mover
// sliders. La cotización real se ejecuta en /dashboard/cotizar contra Telcel.
// ────────────────────────────────────────────────────────────────────

function simularImpacto(args: {
  lineas: number;
  plazo: number;
  palancas: PalancasManual;
  /** Renta base estimada por línea (MXN/mes). Heurística según plan. */
  rentaPerLineaEstim?: number;
  /** Precio equipo estimado (MXN). Heurística. */
  precioEquipoEstim?: number;
  equiposQty: number;
}): { ab: number; montoTotal: number; ahorro: number; rentabilidad: number } {
  const { lineas, plazo, palancas, equiposQty } = args;
  const rentaBase = args.rentaPerLineaEstim ?? 379;
  const precioEquipo = args.precioEquipoEstim ?? 18000;

  const rentaConDesc = rentaBase * (1 - palancas.descuento_renta_pct / 100);
  const mesesPagados = Math.max(0, plazo - palancas.meses_gratis);
  const ingresoRenta = rentaConDesc * lineas * mesesPagados;

  const costoEquipos =
    precioEquipo *
    equiposQty *
    (1 - palancas.tasa_negociada_pct / 100);
  const aportacionTotal = palancas.aportacion_voluntaria * equiposQty;

  const montoTotal = ingresoRenta + aportacionTotal;
  const costoBruto = costoEquipos + ingresoRenta * 0.15; // overhead simplificado

  // A/B = costo equipos / ingresos. Bajar palancas → A/B sube.
  const ab = ingresoRenta > 0 ? (costoEquipos / ingresoRenta) * 100 : 0;

  // Ahorro vs sin palancas (baseline AB 25% sin ajuste).
  const montoBaseline = rentaBase * lineas * plazo;
  const ahorro = Math.max(0, montoBaseline - montoTotal);

  const rentabilidad = montoTotal > 0
    ? ((montoTotal - costoBruto) / montoTotal) * 100
    : 0;

  return {
    ab: Number.isFinite(ab) ? ab : 0,
    montoTotal: Number.isFinite(montoTotal) ? montoTotal : 0,
    ahorro: Number.isFinite(ahorro) ? ahorro : 0,
    rentabilidad: Number.isFinite(rentabilidad) ? rentabilidad : 0,
  };
}

// ────────────────────────────────────────────────────────────────────
// Página
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

  // Palancas manuales (para preview live antes de pedirle a Claude).
  const [palancasManual, setPalancasManual] = useState<PalancasManual>(
    PALANCAS_DEFAULT,
  );

  // Catálogos (best-effort — usamos fallback si no se cargan)
  const [equiposCatalog, setEquiposCatalog] = useState<EquipoOption[]>(
    EQUIPOS_FALLBACK,
  );
  const [planesCatalog, setPlanesCatalog] = useState<PlanOption[]>([]);
  const [clientesCatalog, setClientesCatalog] = useState<Cliente[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Submit state
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  // Cargar catálogos al montar.
  useEffect(() => {
    let alive = true;
    setCatalogLoading(true);
    (async () => {
      try {
        const [eqRes, plRes, clRes] = await Promise.all([
          apiFetch("/api/catalogos/equipos", { cache: "no-store" }),
          apiFetch("/api/catalogos/planes", { cache: "no-store" }),
          apiFetch("/api/clientes", { cache: "no-store" }),
        ]);
        if (!alive) return;
        if (eqRes.ok) {
          const data = (await eqRes.json()) as {
            equipos?: EquipoOption[];
            unavailable?: boolean;
          };
          if (
            !data.unavailable &&
            Array.isArray(data.equipos) &&
            data.equipos.length
          ) {
            setEquiposCatalog(data.equipos);
          }
        }
        if (plRes.ok) {
          const data = (await plRes.json()) as {
            planes?: PlanOption[];
            unavailable?: boolean;
          };
          if (
            !data.unavailable &&
            Array.isArray(data.planes) &&
            data.planes.length
          ) {
            setPlanesCatalog(data.planes);
          }
        }
        if (clRes.ok) {
          const data = (await clRes.json()) as { clientes?: Cliente[] };
          if (Array.isArray(data.clientes)) {
            setClientesCatalog(data.clientes);
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
  const rfcValido = useMemo(
    () => !rfc.trim() || RFC_REGEX.test(rfc.trim()),
    [rfc],
  );
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

  // Estimar precio/renta del plan (heurística por nombre — no hay endpoint).
  const rentaPerLineaEstim = useMemo(() => {
    const planMatch = planesCatalog.find(
      (p) => p.label === plan && typeof p.precio === "number",
    );
    return planMatch?.precio;
  }, [plan, planesCatalog]);

  // Preview live: cuando hay propuesta de Claude, esas son las palancas
  // mostradas. Si no, usamos las manuales del usuario.
  const palancasActivas: PalancasManual =
    submit.kind === "ok" ? submit.data.palancas : palancasManual;

  const sim = useMemo(
    () =>
      simularImpacto({
        lineas,
        plazo,
        palancas: palancasActivas,
        rentaPerLineaEstim,
        equiposQty,
      }),
    [lineas, plazo, palancasActivas, rentaPerLineaEstim, equiposQty],
  );

  const hasActivePalancas = useMemo(() => {
    return (
      palancasActivas.aportacion_voluntaria > 0 ||
      palancasActivas.meses_gratis > 0 ||
      palancasActivas.descuento_renta_pct > 0 ||
      palancasActivas.beneficio_megas_pct > 0 ||
      palancasActivas.tasa_negociada_pct > 0
    );
  }, [palancasActivas]);

  const handleOptimizar = useCallback(async () => {
    if (!formValido) return;
    setSubmit({ kind: "loading" });

    try {
      const res = await apiFetch("/api/optimizar", {
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
  }, [
    formValido,
    rfc,
    lineas,
    plan,
    plazo,
    grupo,
    modalidad,
    equipoSeleccionado,
    equiposQty,
    abTarget,
    preferencias,
  ]);

  function handleAplicarYCotizar() {
    if (submit.kind !== "ok" && !hasActivePalancas) return;
    const palancas =
      submit.kind === "ok" ? submit.data.palancas : palancasManual;
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
          palancas,
          rentabilidad_simulada:
            submit.kind === "ok"
              ? submit.data.rentabilidad_simulada
              : sim.rentabilidad,
          razonamiento:
            submit.kind === "ok" ? submit.data.razonamiento : "",
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

  function removePalanca(key: keyof PalancasManual) {
    if (submit.kind === "ok") {
      // Si la palanca viene de Claude, "desclamamos" la propuesta y volvemos
      // a manual con la palanca removida.
      setPalancasManual({ ...submit.data.palancas, [key]: 0 });
      setSubmit({ kind: "idle" });
      return;
    }
    setPalancasManual((p) => ({ ...p, [key]: 0 }));
  }

  function setPalanca<K extends keyof PalancasManual>(
    key: K,
    value: PalancasManual[K],
  ) {
    if (submit.kind === "ok") {
      // Al ajustar manualmente, abandonamos la propuesta de Claude.
      setPalancasManual({ ...submit.data.palancas, [key]: value });
      setSubmit({ kind: "idle" });
      return;
    }
    setPalancasManual((p) => ({ ...p, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar active="optimizar" />

      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 py-10 md:py-16">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <Link
              href="/dashboard"
              className="hover:text-indigo-600 transition"
            >
              Inicio
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">
              Optimizar palancas
            </span>
          </div>

          {/* H1 */}
          <header className="mb-10">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-4"
            >
              <Sparkles className="w-3.5 h-3.5" />
              BETA · Asistido por Claude
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
              Optimizar palancas
            </h1>
            <p className="mt-3 text-base md:text-lg text-slate-600 max-w-2xl">
              Ajusta variables y previsualiza impacto en A/B y monto final. O
              deja que Claude encuentre la mejor combinación para tu AB target.
            </p>
          </header>

          {/* Layout 2 columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* LEFT: palancas (≈40%) */}
            <div className="lg:col-span-2 space-y-5">
              {/* Perfil cliente */}
              <PalancaCard
                title="Perfil del cliente"
                description="Quién, cuántas líneas y bajo qué plan."
                Icon={User}
                accent="indigo"
                delay={0}
              >
                <div className="space-y-4">
                  <Field label="Cliente" htmlFor="opt-rfc">
                    <input
                      id="opt-rfc"
                      list="opt-clientes-list"
                      type="text"
                      value={rfc}
                      onChange={(e) => setRfc(e.target.value.toUpperCase())}
                      placeholder="RFC (ej. ASE1803062B7) o búscalo por nombre"
                      className={inputCls}
                      maxLength={13}
                      aria-invalid={!!rfc.trim() && !rfcValido}
                      aria-describedby={
                        rfc.trim() && !rfcValido ? "opt-rfc-error" : undefined
                      }
                    />
                    {clientesCatalog.length > 0 && (
                      <datalist id="opt-clientes-list">
                        {clientesCatalog.slice(0, 300).map((c) => (
                          <option
                            key={c.rfc}
                            value={c.rfc}
                            label={c.nombre}
                          />
                        ))}
                      </datalist>
                    )}
                    {rfc.trim() && !rfcValido && (
                      <p
                        id="opt-rfc-error"
                        className="mt-1.5 text-xs text-rose-600"
                      >
                        RFC inválido. Formato: XAXX010101XXX.
                      </p>
                    )}
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Líneas" htmlFor="opt-lineas">
                      <input
                        id="opt-lineas"
                        type="number"
                        min={1}
                        max={500}
                        value={lineas}
                        onChange={(e) =>
                          setLineas(Math.max(1, Number(e.target.value) || 1))
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Plazo" htmlFor="opt-plazo">
                      <select
                        id="opt-plazo"
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

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Grupo" htmlFor="opt-grupo">
                      <select
                        id="opt-grupo"
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
                    <Field label="Modalidad" htmlFor="opt-modalidad">
                      <select
                        id="opt-modalidad"
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
                    htmlFor="opt-plan"
                    hint={
                      catalogLoading
                        ? "Cargando catálogo…"
                        : planesCatalog.length === 0
                          ? "Catálogo no disponible — escribe el nombre."
                          : "Selecciona del catálogo o escribe."
                    }
                  >
                    <input
                      id="opt-plan"
                      list={planesCatalog.length > 0 ? "planes-list" : undefined}
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      className={inputCls}
                      placeholder="TELCEL EMPRESA BASE"
                    />
                    {planesCatalog.length > 0 && (
                      <datalist id="planes-list">
                        {planesCatalog.slice(0, 200).map((p, i) => (
                          <option key={i} value={p.label} />
                        ))}
                      </datalist>
                    )}
                  </Field>
                </div>
              </PalancaCard>

              {/* Equipo */}
              <PalancaCard
                title="Equipo"
                description="Modelo y cantidad de equipos (subset de las líneas)."
                Icon={Smartphone}
                accent="cyan"
                delay={0.05}
              >
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field label="Modelo" htmlFor="opt-equipo">
                      <input
                        id="opt-equipo"
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
                  <Field label="Cantidad" htmlFor="opt-equipos-qty">
                    <input
                      id="opt-equipos-qty"
                      type="number"
                      min={0}
                      max={lineas}
                      value={equiposQty}
                      onChange={(e) =>
                        setEquiposQty(
                          Math.max(0, Number(e.target.value) || 0),
                        )
                      }
                      className={inputCls}
                    />
                  </Field>
                </div>
              </PalancaCard>

              {/* Aportación voluntaria */}
              <PalancaCard
                title="Aportación voluntaria"
                description="Monto que el cliente paga por equipo, fuera de su renta."
                Icon={PiggyBank}
                accent="pink"
                delay={0.1}
                badge={
                  palancasActivas.aportacion_voluntaria > 0
                    ? `$${palancasActivas.aportacion_voluntaria.toLocaleString("es-MX")}`
                    : undefined
                }
              >
                <SliderRow
                  id="opt-aportacion"
                  min={0}
                  max={10000}
                  step={250}
                  value={palancasActivas.aportacion_voluntaria}
                  onChange={(v) => setPalanca("aportacion_voluntaria", v)}
                  format={(v) => (
                    <span>
                      $<NumberFlow value={v} />
                    </span>
                  )}
                  leftLabel="$0"
                  rightLabel="$10k"
                  ariaLabel="Aportación voluntaria por equipo en MXN"
                />
              </PalancaCard>

              {/* Meses gratis */}
              <PalancaCard
                title="Meses gratis"
                description="Meses sin renta al inicio del contrato."
                Icon={Gift}
                accent="indigo"
                delay={0.15}
                badge={
                  palancasActivas.meses_gratis > 0
                    ? `${palancasActivas.meses_gratis} mes${palancasActivas.meses_gratis !== 1 ? "es" : ""}`
                    : undefined
                }
              >
                <SliderRow
                  id="opt-meses"
                  min={0}
                  max={14}
                  step={1}
                  value={palancasActivas.meses_gratis}
                  onChange={(v) => setPalanca("meses_gratis", v)}
                  format={(v) => <NumberFlow value={v} suffix=" meses" />}
                  leftLabel="0"
                  rightLabel="14"
                  ariaLabel="Meses gratis al inicio del contrato"
                />
              </PalancaCard>

              {/* Descuento renta */}
              <PalancaCard
                title="Descuento en renta"
                description="% de descuento sobre la renta mensual de cada línea."
                Icon={TrendingDown}
                accent="cyan"
                delay={0.2}
                badge={
                  palancasActivas.descuento_renta_pct > 0
                    ? `${palancasActivas.descuento_renta_pct}% off`
                    : undefined
                }
              >
                <SliderRow
                  id="opt-descuento"
                  min={0}
                  max={40}
                  step={2}
                  value={palancasActivas.descuento_renta_pct}
                  onChange={(v) => setPalanca("descuento_renta_pct", v)}
                  format={(v) => <NumberFlow value={v} suffix="%" />}
                  leftLabel="0%"
                  rightLabel="40%"
                  ariaLabel="Porcentaje de descuento en renta"
                />
              </PalancaCard>

              {/* Beneficio megas */}
              <PalancaCard
                title="Beneficio megas"
                description="Aumenta los megas incluidos del plan sin costo extra."
                Icon={Wifi}
                accent="pink"
                delay={0.25}
                badge={
                  palancasActivas.beneficio_megas_pct > 0
                    ? `+${palancasActivas.beneficio_megas_pct}%`
                    : undefined
                }
              >
                <ChipRow
                  options={BENEFICIO_MEGAS_OPCIONES}
                  value={palancasActivas.beneficio_megas_pct}
                  onChange={(v) => setPalanca("beneficio_megas_pct", v)}
                  suffix="%"
                  ariaLabel="Porcentaje de beneficio megas"
                />
              </PalancaCard>

              {/* Tasa negociada */}
              <PalancaCard
                title="Tasa negociada equipo"
                description="% que Telcel descuenta del precio de lista del equipo."
                Icon={Percent}
                accent="indigo"
                delay={0.3}
                badge={
                  palancasActivas.tasa_negociada_pct > 0
                    ? `-${palancasActivas.tasa_negociada_pct}%`
                    : undefined
                }
              >
                <ChipRow
                  options={TASA_NEGOCIADA_OPCIONES}
                  value={palancasActivas.tasa_negociada_pct}
                  onChange={(v) => setPalanca("tasa_negociada_pct", v)}
                  suffix="%"
                  ariaLabel="Porcentaje de tasa negociada del equipo"
                />
              </PalancaCard>

              {/* AB target + preferencias para Claude */}
              <PalancaCard
                title="Encárgaselo a Claude"
                description="Define tu AB target y pídele que encuentre la mejor combinación automáticamente."
                Icon={Target}
                accent="cyan"
                delay={0.35}
              >
                <div className="space-y-4">
                  <Field
                    label={`AB target: ${abTarget}%`}
                    htmlFor="opt-ab-target"
                    hint="Por defecto 25% (regla AB 25%)."
                  >
                    <input
                      id="opt-ab-target"
                      type="range"
                      min={15}
                      max={35}
                      step={1}
                      value={abTarget}
                      onChange={(e) => setAbTarget(Number(e.target.value))}
                      aria-valuenow={abTarget}
                      aria-valuemin={15}
                      aria-valuemax={35}
                      className="w-full lumina-slider"
                    />
                    <div className="flex justify-between text-[10px] font-medium text-slate-500 mt-1">
                      <span>15%</span>
                      <span>25%</span>
                      <span>35%</span>
                    </div>
                  </Field>
                  <Field
                    label="Preferencias (opcional)"
                    htmlFor="opt-preferencias"
                    hint="Ej. 'sin aportación', 'prefer meses gratis'."
                  >
                    <input
                      id="opt-preferencias"
                      type="text"
                      value={preferencias}
                      onChange={(e) => setPreferencias(e.target.value)}
                      className={inputCls}
                      placeholder="sin aportación"
                      maxLength={300}
                    />
                  </Field>
                  <motion.button
                    type="button"
                    onClick={handleOptimizar}
                    disabled={!formValido || submit.kind === "loading"}
                    whileTap={{ scale: 0.97 }}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-sm shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-300/50 transition disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    {submit.kind === "loading" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Pensando…
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Optimizar con Claude
                      </>
                    )}
                  </motion.button>
                  {submit.kind === "error" && (
                    <div
                      role="alert"
                      className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-rose-700 leading-snug">
                        <span className="font-semibold">
                          No pudimos optimizar:
                        </span>{" "}
                        {submit.msg}
                      </div>
                    </div>
                  )}
                </div>
              </PalancaCard>
            </div>

            {/* RIGHT: preview impacto (≈60%) */}
            <div className="lg:col-span-3">
              <div className="lg:sticky lg:top-8">
                <PreviewPanel
                  sim={sim}
                  abTarget={abTarget}
                  hasActivePalancas={hasActivePalancas}
                  palancasActivas={palancasActivas}
                  onRemovePalanca={removePalanca}
                  proposalLoaded={submit.kind === "ok"}
                  proposalData={submit.kind === "ok" ? submit.data : null}
                  onAplicarYCotizar={handleAplicarYCotizar}
                  formValido={formValido}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Estilos del slider LUMINA */}
      <style jsx global>{`
        .lumina-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 9999px;
          background: linear-gradient(
            to right,
            #4f46e5 0%,
            #06b6d4 var(--lumina-fill, 50%),
            #e2e8f0 var(--lumina-fill, 50%),
            #e2e8f0 100%
          );
          outline: none;
        }
        .lumina-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
          border: 3px solid #ffffff;
          box-shadow:
            0 2px 4px rgba(79, 70, 229, 0.25),
            0 0 0 1px rgba(79, 70, 229, 0.1);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .lumina-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .lumina-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
          border: 3px solid #ffffff;
          box-shadow:
            0 2px 4px rgba(79, 70, 229, 0.25),
            0 0 0 1px rgba(79, 70, 229, 0.1);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-componentes
// ────────────────────────────────────────────────────────────────────

type Accent = "indigo" | "cyan" | "pink";

const ACCENT_BG: Record<Accent, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  cyan: "bg-cyan-50 text-cyan-600",
  pink: "bg-pink-50 text-pink-600",
};

const ACCENT_BADGE: Record<Accent, string> = {
  indigo: "bg-indigo-100 text-indigo-700",
  cyan: "bg-cyan-100 text-cyan-700",
  pink: "bg-pink-100 text-pink-700",
};

function PalancaCard({
  title,
  description,
  Icon,
  accent,
  delay,
  badge,
  children,
}: {
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: Accent;
  delay: number;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6"
    >
      <header className="flex items-start gap-3 mb-4">
        <span
          className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl ${ACCENT_BG[accent]}`}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {title}
            </h2>
            {badge && (
              <span
                className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${ACCENT_BADGE[accent]}`}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 leading-snug">
            {description}
          </p>
        </div>
      </header>
      {children}
    </motion.section>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const hintId = htmlFor && hint ? `${htmlFor}-hint` : undefined;
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function SliderRow({
  id,
  min,
  max,
  step,
  value,
  onChange,
  format,
  leftLabel,
  rightLabel,
  ariaLabel,
}: {
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => React.ReactNode;
  leftLabel: string;
  rightLabel: string;
  ariaLabel: string;
}) {
  const fillPct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">
          {format(value)}
        </span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Mueve para ajustar
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        className="w-full lumina-slider"
        style={{ ["--lumina-fill" as string]: `${fillPct}%` }}
      />
      <div className="flex justify-between text-[10px] font-medium text-slate-400 mt-1">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function ChipRow({
  options,
  value,
  onChange,
  suffix,
  ariaLabel,
}: {
  options: readonly number[];
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={[
              "px-3.5 py-1.5 rounded-full text-sm font-semibold transition",
              active
                ? "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-sm shadow-indigo-200/60"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {opt}
            {suffix}
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Preview panel
// ────────────────────────────────────────────────────────────────────

const PALANCA_META: Record<
  keyof PalancasManual,
  { label: string; format: (v: number) => string; Icon: React.ComponentType<{ className?: string }>; accent: Accent }
> = {
  aportacion_voluntaria: {
    label: "Aportación",
    format: (v) => `$${v.toLocaleString("es-MX")}`,
    Icon: PiggyBank,
    accent: "pink",
  },
  meses_gratis: {
    label: "Meses gratis",
    format: (v) => `${v} mes${v !== 1 ? "es" : ""}`,
    Icon: Gift,
    accent: "indigo",
  },
  descuento_renta_pct: {
    label: "Descuento renta",
    format: (v) => `${v}% off`,
    Icon: TrendingDown,
    accent: "cyan",
  },
  beneficio_megas_pct: {
    label: "Beneficio megas",
    format: (v) => `+${v}%`,
    Icon: Wifi,
    accent: "pink",
  },
  tasa_negociada_pct: {
    label: "Tasa equipo",
    format: (v) => `-${v}%`,
    Icon: Percent,
    accent: "indigo",
  },
};

function PreviewPanel({
  sim,
  abTarget,
  hasActivePalancas,
  palancasActivas,
  onRemovePalanca,
  proposalLoaded,
  proposalData,
  onAplicarYCotizar,
  formValido,
}: {
  sim: {
    ab: number;
    montoTotal: number;
    ahorro: number;
    rentabilidad: number;
  };
  abTarget: number;
  hasActivePalancas: boolean;
  palancasActivas: PalancasManual;
  onRemovePalanca: (key: keyof PalancasManual) => void;
  proposalLoaded: boolean;
  proposalData: OptimizarResponse | null;
  onAplicarYCotizar: () => void;
  formValido: boolean;
}) {
  // El A/B "real" cuando hay propuesta de Claude viene del backend; si no,
  // usamos el simulador local.
  const abShown = proposalLoaded && proposalData
    ? proposalData.ab_logrado
    : sim.ab;

  const abColor =
    abShown >= 25
      ? "text-emerald-600 bg-emerald-50"
      : abShown >= 15
        ? "text-amber-600 bg-amber-50"
        : "text-rose-600 bg-rose-50";

  // Chart data: 2 series antes/después.
  const chartData = useMemo(() => {
    // Generamos una curva ficticia de A/B "evolución temporal" (12 puntos)
    // que comunica visualmente la mejora. NO son meses reales — es un sparkline.
    const baseAb = 35; // baseline sin palancas
    const targetAb = abShown;
    return Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      return {
        i,
        antes: baseAb + Math.sin(i * 0.7) * 2,
        despues:
          baseAb +
          (targetAb - baseAb) *
            (1 - Math.pow(1 - t, 2)) +
            Math.sin(i * 0.9) * 0.8,
      };
    });
  }, [abShown]);

  const activeKeys = (Object.keys(palancasActivas) as Array<keyof PalancasManual>).filter(
    (k) => palancasActivas[k] > 0,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
    >
      <header className="px-6 pt-6 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
              Resultado proyectado
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Simulación local · La cotización contra Telcel confirma los
              números reales.
            </p>
          </div>
          {proposalLoaded && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-100 to-cyan-100 text-indigo-700 text-[11px] font-bold">
              <Sparkles className="w-3 h-3" />
              Propuesta de Claude
            </span>
          )}
        </div>
      </header>

      {hasActivePalancas ? (
        <>
          {/* 3 KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <KpiBlock
              label="A/B proyectada"
              value={
                <span className={`px-2 py-0.5 rounded-lg ${abColor}`}>
                  <NumberFlow
                    value={Number(abShown.toFixed(1))}
                    suffix="%"
                  />
                </span>
              }
              hint={`Target ${abTarget}%`}
            />
            <KpiBlock
              label="Monto total"
              value={
                <span className="text-slate-900">
                  <NumberFlow
                    value={Math.round(sim.montoTotal)}
                    format={{
                      style: "currency",
                      currency: "MXN",
                      maximumFractionDigits: 0,
                    }}
                  />
                </span>
              }
              hint="Suma plazo completo"
            />
            <KpiBlock
              label="Ahorro vs base"
              value={
                <span className="text-indigo-600">
                  <NumberFlow
                    value={Math.round(sim.ahorro)}
                    format={{
                      style: "currency",
                      currency: "MXN",
                      maximumFractionDigits: 0,
                    }}
                  />
                </span>
              }
              hint={`Rentabilidad ${sim.rentabilidad.toFixed(1)}%`}
            />
          </div>

          {/* Chart antes/después */}
          <div className="px-6 pt-5 pb-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Evolución A/B
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-semibold">
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  Sin palancas
                </span>
                <span className="inline-flex items-center gap-1.5 text-cyan-700">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  Con palancas
                </span>
              </div>
            </div>
            <div className="h-32 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient
                      id="grad-despues"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="grad-antes"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 11,
                      padding: "6px 10px",
                    }}
                    formatter={(v) =>
                      typeof v === "number" ? `${v.toFixed(1)}%` : String(v)
                    }
                    labelFormatter={() => ""}
                  />
                  <Area
                    type="monotone"
                    dataKey="antes"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    fill="url(#grad-antes)"
                    isAnimationActive
                    animationDuration={1500}
                  />
                  <Area
                    type="monotone"
                    dataKey="despues"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fill="url(#grad-despues)"
                    isAnimationActive
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Palancas activas (chips removibles) */}
          <div className="px-6 pt-4 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Palancas activas ({activeKeys.length})
            </h3>
            <AnimatePresence mode="popLayout">
              <motion.div layout className="flex flex-wrap gap-2">
                {activeKeys.map((k) => {
                  const meta = PALANCA_META[k];
                  return (
                    <motion.span
                      key={k}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.18 }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${ACCENT_BADGE[meta.accent]}`}
                    >
                      <meta.Icon className="w-3 h-3" />
                      {meta.label}: {meta.format(palancasActivas[k])}
                      <button
                        type="button"
                        onClick={() => onRemovePalanca(k)}
                        aria-label={`Quitar palanca ${meta.label}`}
                        className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-white/60 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.span>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Razonamiento de Claude si aplica */}
          {proposalLoaded && proposalData?.razonamiento && (
            <div className="px-6 pt-4">
              <details className="group rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                <summary className="flex items-center justify-between cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-600 list-none">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    Razonamiento de Claude
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition" />
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {proposalData.razonamiento}
                </p>
              </details>
            </div>
          )}

          {/* CTA principal */}
          <div className="px-6 pt-5 pb-6">
            <motion.button
              type="button"
              onClick={onAplicarYCotizar}
              disabled={!formValido}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-base shadow-lg shadow-indigo-200/60 hover:shadow-xl hover:shadow-indigo-300/60 transition disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              Aplicar y cotizar contra Telcel
              <ArrowRight className="w-4 h-4" />
            </motion.button>
            <p className="mt-2 text-[11px] text-center text-slate-500">
              Te llevamos al chat con el prompt pre-cargado · Solo revisa y
              presiona Enter.
            </p>
          </div>
        </>
      ) : (
        <EmptyState />
      )}
    </motion.div>
  );
}

function KpiBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="px-6 py-5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-slate-400 font-medium">
          {hint}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-12 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center mb-4"
        aria-hidden="true"
      >
        <Sparkles className="w-7 h-7 text-indigo-500" />
      </motion.div>
      <h3 className="text-base font-bold text-slate-900">
        Ajusta una palanca para ver el impacto
      </h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-sm mx-auto">
        Mueve los sliders del lado izquierdo o pídele a Claude que encuentre
        la mejor combinación para tu AB target.
      </p>
    </div>
  );
}

// Helpers de estilos (compartidos)
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition";
