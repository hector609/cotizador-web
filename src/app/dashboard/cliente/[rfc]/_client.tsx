"use client";

/**
 * Client Components para la página /dashboard/cliente/[rfc].
 *
 * Aislamos aquí todo lo interactivo (NumberFlow, Recharts, framer-motion)
 * para que la página padre siga siendo Server Component (sin spinner inicial).
 *
 * Exporta:
 *  - KpiCardSpark: KPI card con NumberFlow + Recharts AreaChart sparkline.
 *  - TimelineList: lista de cotizaciones con stagger fade-up entrance.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Download, ArrowRight } from "lucide-react";
import type { Cotizacion, EstadoCotizacion } from "@/types/cotizacion";

function fmtMxn(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

/* ---------- KPI card con NumberFlow + sparkline cyan ---------- */

interface KpiCardSparkProps {
  label: string;
  value: number;
  /** Formato del NumberFlow: "int" cuenta entera, "mxn" con currency. */
  format: "int" | "mxn";
  hint?: string;
  /** Tono del delta chip (opcional). */
  deltaTone?: "emerald" | "amber" | "rose" | "indigo";
  delta?: string;
  /** Serie sintética estable para el sparkline. */
  series: number[];
  icon?: ReactNode;
}

export function KpiCardSpark({
  label,
  value,
  format,
  hint,
  delta,
  deltaTone = "emerald",
  series,
  icon,
}: KpiCardSparkProps) {
  const data = series.map((v, i) => ({ x: i, y: v }));

  const toneClasses: Record<NonNullable<KpiCardSparkProps["deltaTone"]>, string> =
    {
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
      amber: "bg-amber-50 text-amber-700 border-amber-200",
      rose: "bg-rose-50 text-rose-700 border-rose-200",
      indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/40 transition-shadow p-6 flex flex-col justify-between min-h-[170px]"
    >
      <div className="flex items-start justify-between gap-3">
        <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {label}
        </dt>
        {delta && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneClasses[deltaTone]}`}
          >
            {delta}
          </span>
        )}
        {icon && !delta && (
          <span aria-hidden="true" className="text-indigo-300">
            {icon}
          </span>
        )}
      </div>
      <div>
        <dd className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight tabular-nums">
          {format === "mxn" ? (
            <NumberFlow
              value={value}
              format={{
                style: "currency",
                currency: "MXN",
                maximumFractionDigits: 0,
              }}
              locales="es-MX"
            />
          ) : (
            <NumberFlow value={value} locales="es-MX" />
          )}
        </dd>
        {hint && (
          <p className="mt-1 text-xs text-slate-500 font-medium">{hint}</p>
        )}
        {/* Sparkline cyan — sólo decorativa, no afecta el dato. */}
        <div className="h-10 mt-3" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id={`spark-${label.replace(/\s+/g, "")}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="y"
                stroke="#06B6D4"
                strokeWidth={2}
                fill={`url(#spark-${label.replace(/\s+/g, "")})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- Timeline ---------- */

export function TimelineList({ rows }: { rows: Cotizacion[] }) {
  // Ordenar por fecha desc — el más reciente arriba.
  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at).getTime() || 0;
    const tb = new Date(b.created_at).getTime() || 0;
    return tb - ta;
  });

  return (
    <ol className="relative" role="list">
      {/* Hairline divider izquierdo */}
      <span
        aria-hidden="true"
        className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200"
      />
      {sorted.map((c, idx) => (
        <TimelineItem
          key={c.id}
          c={c}
          mostRecent={idx === 0}
          delayIndex={idx}
        />
      ))}
    </ol>
  );
}

function TimelineItem({
  c,
  mostRecent,
  delayIndex,
}: {
  c: Cotizacion;
  mostRecent: boolean;
  delayIndex: number;
}) {
  const fecha = new Date(c.created_at);
  const fechaStr = isNaN(fecha.getTime())
    ? c.created_at
    : fecha.toLocaleString("es-MX", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

  const totalMensual = c.lineas * c.plan;

  const dotColor =
    c.estado === "completada"
      ? "bg-emerald-500"
      : c.estado === "pendiente"
        ? "bg-amber-500"
        : "bg-rose-500";
  const dotRing = mostRecent ? "ring-4 ring-indigo-100" : "";
  const folio = c.id.length > 8 ? c.id.slice(0, 8).toUpperCase() : c.id;

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(delayIndex, 12) * 0.05,
        ease: "easeOut",
      }}
      className="relative pl-8 pb-6 last:pb-0"
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full ${dotColor} ${dotRing}`}
      />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-xs text-cyan-600 font-semibold">
              {folio}
            </p>
            <EstadoBadge estado={c.estado} />
            {mostRecent && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                Más reciente
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 mt-2">
            {c.equipo || (
              <span className="text-slate-400 italic">Sin equipo</span>
            )}
            <span className="text-slate-300 mx-1.5">·</span>
            <span className="text-slate-500">
              {c.lineas} {c.lineas === 1 ? "línea" : "líneas"} ×{" "}
              {fmtMxn(c.plan)}
            </span>
          </p>
          <p className="text-xs text-slate-400 mt-1 tabular-nums">{fechaStr}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl md:text-2xl font-extrabold text-slate-900 tabular-nums">
            {fmtMxn(totalMensual)}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-0.5 font-semibold">
            renta mensual
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {c.estado === "completada" && c.pdf_url && (
          <a
            href={c.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-indigo-100 hover:border-indigo-300 transition"
            aria-label={`Descargar PDF cliente de cotización ${c.id}`}
          >
            <Download className="w-3.5 h-3.5" />
            PDF cliente
          </a>
        )}
        {c.estado === "completada" && c.pdf_url_interno && (
          <a
            href={c.pdf_url_interno}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 hover:border-slate-300 transition"
            aria-label={`Descargar PDF interno de cotización ${c.id}`}
          >
            <Download className="w-3.5 h-3.5" />
            PDF interno
          </a>
        )}
        {c.estado === "fallida" && (
          <Link
            href={`/dashboard/cotizar${c.rfc ? `?rfc=${encodeURIComponent(c.rfc)}` : ""}`}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 transition"
          >
            Reintentar <ArrowRight className="w-3 h-3" />
          </Link>
        )}
        {c.estado === "pendiente" && (
          <span className="text-xs text-amber-600 italic">En proceso…</span>
        )}
      </div>
    </motion.li>
  );
}

function EstadoBadge({ estado }: { estado: EstadoCotizacion }) {
  if (estado === "completada") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
        Completada
      </span>
    );
  }
  if (estado === "pendiente") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
      Falló
    </span>
  );
}
