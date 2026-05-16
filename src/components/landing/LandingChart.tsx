"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";

export type ChartStat = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  data: { v: number }[];
  color: string;
  gradientId: string;
  display?: string;
};

interface LandingChartProps {
  stats: ChartStat[];
}

export function LandingChart({ stats }: LandingChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8"
    >
      {stats.map((s, idx) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: idx * 0.1 }}
          className="relative bg-white rounded-3xl p-6 border border-slate-100 shadow-sm shadow-indigo-100/40 hover:shadow-lg hover:shadow-indigo-200/40 transition-shadow"
        >
          <div className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
            {s.display ? (
              <span>{s.display}</span>
            ) : (
              <>
                {s.prefix}
                <NumberFlow
                  value={s.value}
                  format={{ maximumFractionDigits: s.decimals ?? 0 }}
                />
                {s.suffix}
              </>
            )}
          </div>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {s.label}
          </div>
          <div className="mt-4 h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={s.data}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={s.gradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#${s.gradientId})`}
                  dot={false}
                  isAnimationActive
                  animationDuration={1400}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
