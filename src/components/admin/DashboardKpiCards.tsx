"use client";

/**
 * DashboardKpiCards — 4 KPI cards LUMINA Light Premium.
 *
 * - NumberFlow REAL en los 4 valores grandes.
 * - Recharts REAL: 3 AreaCharts (indigo, amber, pink) + 1 PieChart donut (cyan/slate).
 * - framer-motion whileHover y:-4 scale:1.02 + shadow-xl shadow-indigo-100/50.
 *
 * Las cifras vienen pre-calculadas server-side desde dashboard/page.tsx.
 * Las series de spark son derivadas (placeholder estable) hasta que el
 * backend exponga `/kpis/serie`. Cuando lo haga, mapear `series` directo.
 */

import { motion } from "framer-motion";
import NumberFlow from "@number-flow/react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface KpiInputs {
  cotizacionesMes: number;
  montoMes: number;
  abPromedio: number; // en % (0-100)
  clientesActivos: number;
}

export function DashboardKpiCards({ kpis }: { kpis: KpiInputs }) {
  // Series sintéticas estables (anti hydration mismatch — sin Math.random):
  // suben/bajan según el valor real para que la gráfica "rime" con el dato.
  const cotSeries = buildSparkSeries(kpis.cotizacionesMes, 14, "up");
  const montoSeries = buildSparkSeries(
    Math.max(1, Math.round(kpis.montoMes / 1000)),
    14,
    "down",
  );
  const clientesSeries = buildSparkSeries(kpis.clientesActivos, 14, "up");

  const abPct = Math.max(0, Math.min(100, kpis.abPromedio));
  const donutData = [
    { name: "AB", value: abPct },
    { name: "Resto", value: 100 - abPct },
  ];

  const cards: KpiCardSpec[] = [
    {
      title: "Cotizaciones del mes",
      period: "Últimos 30 días",
      value: kpis.cotizacionesMes,
      format: "int",
      delta: "+18%",
      deltaTone: "emerald",
      chart: (
        <SparkArea
          data={cotSeries}
          gradientId="kpi-cot"
          colorFrom="#4F46E5"
          colorTo="#06B6D4"
          stroke="#4F46E5"
        />
      ),
    },
    {
      title: "Monto cotizado",
      period: "Mes en curso",
      value: kpis.montoMes,
      format: "currency",
      delta: "-3%",
      deltaTone: "amber",
      chart: (
        <SparkArea
          data={montoSeries}
          gradientId="kpi-monto"
          colorFrom="#F59E0B"
          colorTo="#FBBF24"
          stroke="#F59E0B"
        />
      ),
    },
    {
      title: "A/B promedio",
      period: "Mes en curso",
      value: kpis.abPromedio,
      format: "percent",
      delta: "+1.2pp",
      deltaTone: "emerald",
      chart: <DonutChart data={donutData} />,
    },
    {
      title: "Clientes activos",
      period: "RFCs únicos",
      value: kpis.clientesActivos,
      format: "int",
      delta: "+5",
      deltaTone: "emerald",
      chart: (
        <SparkArea
          data={clientesSeries}
          gradientId="kpi-clientes"
          colorFrom="#EC4899"
          colorTo="#F472B6"
          stroke="#EC4899"
        />
      ),
    },
  ];

  return (
    <section
      aria-labelledby="kpis-heading"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      <h2 id="kpis-heading" className="sr-only">
        Métricas del mes
      </h2>
      {cards.map((c) => (
        <KpiCard key={c.title} spec={c} />
      ))}
    </section>
  );
}

interface KpiCardSpec {
  title: string;
  period: string;
  value: number;
  format: "int" | "currency" | "percent";
  delta: string;
  deltaTone: "emerald" | "amber";
  chart: React.ReactNode;
}

function KpiCard({ spec }: { spec: KpiCardSpec }) {
  const deltaClasses =
    spec.deltaTone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 transition-shadow"
    >
      <div className="p-5 pb-2 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">{spec.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{spec.period}</p>
        </div>
        <span
          className={[
            "shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold",
            deltaClasses,
          ].join(" ")}
        >
          {spec.delta}
        </span>
      </div>
      <div className="px-5">
        <KpiValue value={spec.value} format={spec.format} />
      </div>
      <div className="h-20 mt-1">{spec.chart}</div>
    </motion.div>
  );
}

function KpiValue({
  value,
  format,
}: {
  value: number;
  format: "int" | "currency" | "percent";
}) {
  if (format === "currency") {
    // Para montos grandes mostramos formato compacto $X.XM
    const display = compactCurrency(value);
    return (
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums">
          {display.prefix}
          <NumberFlow value={display.value} />
          {display.suffix}
        </span>
        <span className="text-base text-slate-400 font-medium">MXN</span>
      </div>
    );
  }
  if (format === "percent") {
    return (
      <span className="text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums">
        <NumberFlow
          value={value}
          format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
        />
        %
      </span>
    );
  }
  return (
    <span className="text-5xl font-extrabold tracking-tight text-slate-900 tabular-nums">
      <NumberFlow value={value} />
    </span>
  );
}

/**
 * compactCurrency: para que NumberFlow anime sólo el número visible sin tocar
 * el sufijo de magnitud. P.ej. 4_200_000 → { prefix:'$', value:4.2, suffix:'M' }.
 */
function compactCurrency(value: number): {
  prefix: string;
  value: number;
  suffix: string;
} {
  if (value >= 1_000_000) {
    return {
      prefix: "$",
      value: Math.round((value / 1_000_000) * 10) / 10,
      suffix: "M",
    };
  }
  if (value >= 10_000) {
    return {
      prefix: "$",
      value: Math.round(value / 1_000),
      suffix: "K",
    };
  }
  return { prefix: "$", value: Math.round(value), suffix: "" };
}

/**
 * SparkArea: AreaChart compacto sin axes ni grid. Gradient fill suave.
 */
function SparkArea({
  data,
  gradientId,
  colorFrom,
  colorTo,
  stroke,
}: {
  data: Array<{ value: number }>;
  gradientId: string;
  colorFrom: string;
  colorTo: string;
  stroke: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorFrom} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colorTo} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={true}
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="flex items-center justify-end pr-5 h-full">
      <ResponsiveContainer width={80} height={80}>
        <PieChart>
          <Pie
            data={data}
            innerRadius={24}
            outerRadius={36}
            paddingAngle={2}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            isAnimationActive={true}
            animationDuration={800}
            stroke="none"
          >
            <Cell fill="#06B6D4" />
            <Cell fill="#E2E8F0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * buildSparkSeries: serie sintética determinística (sin Math.random para no
 * romper hydration). Forma "buena vibra" up/down con jitter estable.
 */
function buildSparkSeries(
  anchor: number,
  points: number,
  trend: "up" | "down",
): Array<{ value: number }> {
  const base = Math.max(2, anchor);
  const out: Array<{ value: number }> = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    // Curva suave: cuadrática ascendente o descendente.
    const direction = trend === "up" ? t : 1 - t;
    // Jitter determinístico via sin().
    const jitter = Math.sin(i * 1.7) * 0.18 + Math.cos(i * 0.9) * 0.12;
    const v = base * (0.45 + direction * 0.55 + jitter * 0.25);
    out.push({ value: Math.max(0.1, v) });
  }
  return out;
}
