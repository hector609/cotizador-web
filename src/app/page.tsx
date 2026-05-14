"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useRef } from "react";
import {
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ServerStackIcon,
  UsersIcon,
} from "@/components/icons";
import { ConciergeWidget } from "@/components/concierge/ConciergeWidget";

/* ---------------------------------------------------------------------- */
/* LUMINA Light Premium — framer-motion + Recharts + NumberFlow            */
/* White surface, indigo/cyan/pink gradients, pill buttons, glow shadows.  */
/* ---------------------------------------------------------------------- */

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 160, damping: 18 },
  },
};

/* Sparkline series — used by the StatsBand AreaCharts */
const seriesA = [
  { v: 12 }, { v: 18 }, { v: 14 }, { v: 22 }, { v: 19 },
  { v: 28 }, { v: 24 }, { v: 33 }, { v: 30 }, { v: 38 }, { v: 42 },
];
const seriesB = [
  { v: 8 }, { v: 11 }, { v: 9 }, { v: 14 }, { v: 13 },
  { v: 18 }, { v: 16 }, { v: 21 }, { v: 23 }, { v: 25 }, { v: 28 },
];
const seriesC = [
  { v: 96 }, { v: 97 }, { v: 96.5 }, { v: 98 }, { v: 99 },
  { v: 98.5 }, { v: 99.2 }, { v: 99.5 }, { v: 99.8 }, { v: 99.7 }, { v: 99.8 },
];
const seriesD = [
  { v: 4 }, { v: 8 }, { v: 12 }, { v: 18 }, { v: 22 },
  { v: 28 }, { v: 32 }, { v: 36 }, { v: 41 }, { v: 45 }, { v: 48 },
];

const features = [
  {
    n: "01",
    icon: ChatBubbleLeftRightIcon,
    title: "Cotiza por chat",
    desc: "Escribe en español natural: cuántas líneas, qué plan, qué equipo. El agente abre el portal, aplica las palancas y arma la cotización mientras tomas otra llamada.",
    gradient: "from-indigo-500 to-cyan-500",
    accent: "indigo",
  },
  {
    n: "02",
    icon: ChartBarIcon,
    title: "Optimiza palancas",
    desc: "El calibrador detecta la combinación de descuentos y subsidios que cumple tu rentabilidad objetivo, sin romper reglas del operador.",
    gradient: "from-cyan-500 to-pink-500",
    accent: "cyan",
  },
  {
    n: "03",
    icon: UsersIcon,
    title: "Multi-distribuidor",
    desc: "Cada vendedor entra con sus credenciales y cotiza en paralelo. Tú ves todo el equipo desde un dashboard consolidado por RFC, vendedor y fecha.",
    gradient: "from-pink-500 to-indigo-500",
    accent: "pink",
  },
  {
    n: "04",
    icon: DocumentTextIcon,
    title: "Historial + PDF doble",
    desc: "Doble salida en cada cotización: PDF oficial para el cliente y PDF interno con margen real. Todo el histórico filtrable y exportable a Excel.",
    gradient: "from-indigo-500 via-cyan-500 to-pink-500",
    accent: "violet",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-white text-slate-900 antialiased overflow-x-hidden selection:bg-cyan-200/50 selection:text-indigo-700">
      <TopNav />
      <Hero />
      <StatsBand />
      <LogosStrip />
      <NumberedFeatures />
      <PricingTeaser />
      <FinalCTA />
      <Footer />
      <ConciergeWidget />
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* TopNav — sticky white/70 backdrop-blur                                  */
/* ---------------------------------------------------------------------- */

function TopNav() {
  return (
    <motion.nav
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/60 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-black tracking-tight"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 via-cyan-500 to-pink-500 text-white shadow-[0_0_18px_rgba(79,70,229,0.35)]">
            <BoltIcon className="w-4 h-4" />
          </span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-500">
            Lumina
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link href="#features" className="text-slate-600 hover:text-indigo-600 transition-colors">
            Producto
          </Link>
          <Link href="#pricing" className="text-slate-600 hover:text-indigo-600 transition-colors">
            Precios
          </Link>
          <Link href="/login" className="text-slate-600 hover:text-indigo-600 transition-colors">
            Login
          </Link>
        </div>
        <Link
          href="/signup"
          className="group relative inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold shadow-[0_8px_24px_-6px_rgba(79,70,229,0.5)] hover:shadow-[0_10px_30px_-4px_rgba(6,182,212,0.55)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
        >
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <span className="relative">Probar gratis</span>
        </Link>
      </div>
    </motion.nav>
  );
}

/* ---------------------------------------------------------------------- */
/* Floating shape — used in hero background                                */
/* ---------------------------------------------------------------------- */

function FloatingBlob({
  className,
  delay = 0,
  duration = 14,
  rotate = true,
}: {
  className: string;
  delay?: number;
  duration?: number;
  rotate?: boolean;
}) {
  return (
    <motion.div
      aria-hidden
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{
        y: [0, 18, 0],
        x: [0, -10, 0],
        ...(rotate ? { rotate: [0, 360] } : {}),
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

/* ---------------------------------------------------------------------- */
/* Hero — min-h-screen + 5 floating shapes + Mac mockup                    */
/* ---------------------------------------------------------------------- */

function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const mockupY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const mockupOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen pt-32 pb-24 px-6 flex items-center overflow-hidden bg-white"
    >
      {/* 5 floating shapes (blur-3xl) */}
      <FloatingBlob
        className="-top-20 -left-24 w-96 h-96 bg-indigo-300/40"
        duration={18}
      />
      <FloatingBlob
        className="top-1/4 -right-32 w-[28rem] h-[28rem] bg-cyan-300/40"
        delay={1.2}
        duration={20}
      />
      <FloatingBlob
        className="bottom-0 left-1/4 w-[32rem] h-[28rem] bg-pink-300/30"
        delay={2.4}
        duration={22}
      />
      <FloatingBlob
        className="top-1/2 left-1/2 w-80 h-80 bg-emerald-200/40"
        delay={0.6}
        duration={16}
      />
      <FloatingBlob
        className="-bottom-24 right-1/3 w-72 h-72 bg-violet-300/30"
        delay={3}
        duration={24}
      />

      {/* Subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto w-full text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8 max-w-5xl mx-auto"
        >
          {/* Eyebrow pill */}
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
              </span>
              Nuevo · IA Generativa para Telcel
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            variants={fadeUp}
            className="text-7xl md:text-8xl font-extrabold tracking-tighter leading-[1.02] text-slate-900"
          >
            Cotiza Telcel en lo que tarda un{" "}
            <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-cyan-500 to-pink-500">
              café.
            </span>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={fadeUp}
            className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed"
          >
            Olvídate de las tablas de Excel. Dile a la IA lo que necesitas y obtén
            una cotización perfecta en segundos. Diseñado para distribuidores premium.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
          >
            <Link
              href="/signup"
              className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold text-lg shadow-[0_18px_40px_-12px_rgba(79,70,229,0.55)] hover:shadow-[0_22px_48px_-10px_rgba(6,182,212,0.6)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
            >
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              <span className="relative">Comenzar ahora</span>
              <ArrowRightIcon className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              Ver demo
            </Link>
          </motion.div>
        </motion.div>

        {/* Hero Mockup */}
        <motion.div
          style={{ y: mockupY, opacity: mockupOpacity }}
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-20 max-w-5xl mx-auto"
        >
          <ChatMockup />
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* ChatMockup — Mac window con chat + cotización + floating palanca cards  */
/* ---------------------------------------------------------------------- */

function ChatMockup() {
  return (
    <div className="relative">
      {/* Floating palanca A — left */}
      <motion.div
        initial={{ opacity: 0, x: -40, rotate: -10 }}
        whileInView={{ opacity: 1, x: 0, rotate: -6 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="hidden lg:flex absolute -left-12 top-24 z-20 flex-col gap-1 bg-white/85 backdrop-blur-xl border border-white p-4 rounded-2xl shadow-xl shadow-indigo-200/40"
      >
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Palanca A
        </div>
        <div className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-500 tabular-nums">
          18.4%
        </div>
        <div className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
          <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
          +2.1% margen
        </div>
      </motion.div>

      {/* Floating Aprobación — right */}
      <motion.div
        initial={{ opacity: 0, x: 40, rotate: 8 }}
        whileInView={{ opacity: 1, x: 0, rotate: 3 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="hidden lg:flex absolute -right-8 top-44 z-20 flex-col gap-1 bg-white/85 backdrop-blur-xl border border-white p-4 rounded-2xl shadow-xl shadow-cyan-200/40"
      >
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Aprobación
        </div>
        <div className="text-lg font-black text-slate-800 flex items-center gap-1.5">
          <CheckCircleIcon className="w-5 h-5 text-cyan-500" />
          Inmediata
        </div>
      </motion.div>

      {/* Mac window */}
      <div className="relative bg-white/90 backdrop-blur-2xl rounded-[2rem] border border-slate-200/60 shadow-2xl shadow-indigo-200/40 overflow-hidden text-left">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-300" />
          <span className="w-3 h-3 rounded-full bg-yellow-300" />
          <span className="w-3 h-3 rounded-full bg-emerald-300" />
          <div className="ml-4 text-sm font-semibold text-slate-500">
            Lumina AI Agent
          </div>
        </div>

        {/* Chat body */}
        <div className="p-8 flex flex-col gap-6 bg-slate-50/40">
          {/* User msg */}
          <div className="flex justify-end">
            <div className="bg-slate-900 text-white rounded-2xl rounded-tr-sm px-6 py-4 max-w-md shadow-sm">
              <p className="text-sm leading-relaxed">
                Necesito 5 iPhone 17 Pro Max de 256GB con Plan Telcel Max Sin
                Límite 6000 a 24 meses para un cliente corporativo.
              </p>
            </div>
          </div>

          {/* Typing */}
          <div className="flex items-center gap-2 text-slate-400 ml-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              className="inline-block w-3 h-3 border-2 border-cyan-500 border-r-transparent rounded-full"
            />
            <span className="text-xs font-medium">
              Analizando inventario y palancas…
            </span>
          </div>

          {/* Completed card */}
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 shadow-lg shadow-indigo-100/50 rounded-2xl rounded-tl-sm p-6 w-full max-w-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-cyan-500 to-pink-500" />
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-xs font-bold text-indigo-600 mb-1 uppercase tracking-wider">
                    Cotización Lista
                  </div>
                  <div className="font-bold text-xl text-slate-900 font-mono text-cyan-600">
                    Folio #2378845
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  A/B 18.4%
                </div>
              </div>
              <div className="space-y-2.5 mb-5 border-t border-slate-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Equipos (5x iPhone 17 PM)</span>
                  <span className="font-medium text-slate-900 tabular-nums">
                    $149,995.00
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Planes (5x TMSL 6000)</span>
                  <span className="font-medium text-slate-900 tabular-nums">
                    $2,995.00 / mes
                  </span>
                </div>
                <div className="flex justify-between text-sm font-medium text-pink-600">
                  <span>Subsidio Aplicado (Platino)</span>
                  <span className="tabular-nums">-$72,922.50</span>
                </div>
              </div>
              <div className="flex justify-between items-end bg-gradient-to-br from-slate-50 to-indigo-50/40 -mx-6 -mb-6 p-6 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-500 mb-1">
                    Pago Inicial Sugerido
                  </div>
                  <div className="font-black text-3xl text-slate-900 tabular-nums">
                    $80,067.50
                    <span className="text-sm text-slate-400 font-medium ml-1">
                      MXN
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-300/50 hover:scale-110 transition-transform"
                  aria-label="Descargar PDF"
                >
                  <DocumentTextIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* StatsBand — 4 stats con NumberFlow + mini AreaChart Recharts            */
/* ---------------------------------------------------------------------- */

type Stat = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  data: { v: number }[];
  color: string;
  gradientId: string;
  display?: string; // override when format doesn't match (e.g. "2:14")
};

const stats: Stat[] = [
  {
    label: "Min. promedio",
    value: 2.14,
    decimals: 2,
    data: seriesA,
    color: "#4F46E5",
    gradientId: "g-stat-a",
    display: "2:14",
  },
  {
    label: "+ Margen B2B",
    value: 18.4,
    decimals: 1,
    suffix: "%",
    data: seriesB,
    color: "#06B6D4",
    gradientId: "g-stat-b",
  },
  {
    label: "Uptime",
    value: 99.8,
    decimals: 1,
    suffix: "%",
    data: seriesC,
    color: "#10B981",
    gradientId: "g-stat-c",
  },
  {
    label: "MXN cotizados",
    value: 48,
    prefix: "$",
    suffix: "M",
    data: seriesD,
    color: "#EC4899",
    gradientId: "g-stat-d",
  },
];

function StatsBand() {
  return (
    <section className="relative py-24 overflow-hidden bg-white border-y border-slate-100">
      {/* Soft gradient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-indigo-50/80 via-cyan-50/60 to-pink-50/60 opacity-70"
      />
      <FloatingBlob
        className="-top-20 right-1/4 w-96 h-96 bg-indigo-200/30"
        duration={20}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-12">
          Promedio en producción
        </p>
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
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* LogosStrip — distribuidores piloto                                      */
/* ---------------------------------------------------------------------- */

function LogosStrip() {
  const logos = ["CeluMaster", "Huvasi", "TelcoPro", "Connectia", "RedNet", "DistriMx"];
  return (
    <section className="py-12 border-b border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-8">
          Distribuidores de confianza
        </p>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={containerVariants}
          className="flex flex-wrap justify-center items-center gap-x-16 gap-y-6"
        >
          {logos.map((name) => (
            <motion.div
              key={name}
              variants={fadeUp}
              className="text-xl md:text-2xl font-black tracking-tighter text-slate-400 hover:text-indigo-600 hover:scale-105 transition-all"
            >
              {name}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* NumberedFeatures — 4 secciones con number gradient + chip eyebrow       */
/* ---------------------------------------------------------------------- */

function NumberedFeatures() {
  return (
    <section
      id="features"
      className="relative py-32 px-6 bg-slate-50 overflow-hidden"
    >
      <FloatingBlob
        className="top-1/3 -left-32 w-96 h-96 bg-indigo-200/30"
        delay={1}
        duration={22}
      />
      <FloatingBlob
        className="bottom-1/4 -right-24 w-80 h-80 bg-pink-200/30"
        delay={2}
        duration={26}
      />

      <div className="relative max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20 space-y-4"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-semibold uppercase tracking-wider">
            Lo que incluye
          </span>
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900">
            El fin de la{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-cyan-500 to-pink-500">
              complejidad.
            </span>
          </h2>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Cuatro pilares diseñados específicamente para acelerar las ventas
            B2B en el ecosistema Telcel.
          </p>
        </motion.div>

        <div className="space-y-24">
          {features.map((f, idx) => {
            const Icon = f.icon;
            const reverse = idx % 2 === 1;
            return (
              <motion.div
                key={f.n}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                variants={scaleIn}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
                  reverse ? "lg:[&>:first-child]:order-2" : ""
                }`}
              >
                {/* Text column */}
                <div className="space-y-5">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[11px] font-semibold uppercase tracking-wider">
                    Feature {f.n}
                  </span>
                  <div
                    className={`text-7xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r ${f.gradient} leading-none`}
                  >
                    {f.n}
                  </div>
                  <h3 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                    {f.title}
                  </h3>
                  <p className="text-lg text-slate-500 leading-relaxed max-w-lg">
                    {f.desc}
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <span
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${f.gradient} text-white shadow-lg shadow-indigo-200/50`}
                    >
                      <Icon className="w-6 h-6" />
                    </span>
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors group"
                    >
                      Ver en acción
                      <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>

                {/* Visual card (tilted) */}
                <motion.div
                  whileHover={{ rotate: 0, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  style={{ rotate: reverse ? -2 : 2 }}
                  className="relative rounded-3xl bg-white border border-slate-100 shadow-2xl shadow-indigo-200/50 p-8 overflow-hidden"
                >
                  {/* Top accent line */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${f.gradient}`}
                  />
                  {/* Big number watermark */}
                  <div className="absolute -right-6 -top-8 text-[10rem] font-black text-slate-50 select-none pointer-events-none leading-none">
                    {f.n}
                  </div>
                  <FeatureMock idx={idx} gradient={f.gradient} />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* Per-feature mock content */
function FeatureMock({ idx, gradient }: { idx: number; gradient: string }) {
  if (idx === 0) {
    return (
      <div className="relative space-y-3">
        <div className="flex justify-end">
          <div className="bg-slate-900 text-white text-xs px-4 py-2 rounded-2xl rounded-tr-sm max-w-[80%]">
            5 iPhone 17 Pro Max · TMSL 6000 · 24m
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-slate-100 text-slate-700 text-xs px-4 py-2 rounded-2xl rounded-tl-sm max-w-[80%]">
            Listo. Aplico A/B 92% para cumplir margen objetivo.
          </div>
        </div>
        <div
          className={`rounded-2xl p-4 bg-gradient-to-br ${gradient} text-white shadow-lg`}
        >
          <div className="text-[10px] uppercase tracking-wider opacity-80">
            Folio
          </div>
          <div className="text-2xl font-black font-mono tabular-nums">
            #2378845
          </div>
        </div>
      </div>
    );
  }
  if (idx === 1) {
    return (
      <div className="space-y-3">
        {[
          { k: "Descuento equipo", v: "35%" },
          { k: "A/B mensual", v: "92%" },
          { k: "Plazo", v: "24 m" },
          { k: "Margen final", v: "+18.4%" },
        ].map((row) => (
          <div
            key={row.k}
            className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3"
          >
            <span className="text-sm text-slate-600">{row.k}</span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {row.v}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (idx === 2) {
    return (
      <div className="space-y-3">
        {[
          { n: "Karla Méndez", r: "OAX140324HE7", c: "from-indigo-500 to-cyan-500" },
          { n: "Diego Romero", r: "ASE1803062B7", c: "from-cyan-500 to-emerald-500" },
          { n: "Paola Vega", r: "TMM940815B23", c: "from-pink-500 to-violet-500" },
        ].map((u) => (
          <div
            key={u.n}
            className="flex items-center gap-3 bg-slate-50 rounded-xl p-3"
          >
            <span
              className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${u.c} text-white text-xs font-bold`}
            >
              {u.n.split(" ").map((x) => x[0]).join("")}
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900">{u.n}</div>
              <div className="text-xs text-slate-500 font-mono">{u.r}</div>
            </div>
            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {[
        { folio: "2378845", total: "$80,067.50", margin: "18.4%" },
        { folio: "2378844", total: "$45,330.00", margin: "16.7%" },
        { folio: "2378843", total: "$112,890.50", margin: "21.1%" },
      ].map((row) => (
        <div
          key={row.folio}
          className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3"
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Folio
            </div>
            <div className="text-sm font-mono font-bold text-cyan-600">
              {row.folio}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-900 tabular-nums">
              {row.total}
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 tabular-nums">
              A/B {row.margin}
            </div>
          </div>
          <DocumentTextIcon className="w-5 h-5 text-indigo-600" />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* PricingTeaser — 3 plan cards con NumberFlow                             */
/* ---------------------------------------------------------------------- */

const plans = [
  {
    name: "Starter",
    price: 0,
    suffix: "/primer mes",
    description: "Para vendedores individuales que prueban el agente.",
    features: ["1 distribuidor", "Cotizaciones ilimitadas", "PDF cliente"],
    cta: "Probar gratis",
    featured: false,
  },
  {
    name: "Pro",
    price: 1490,
    suffix: "/mes",
    description: "Para equipos B2B que cotizan a diario.",
    features: [
      "Hasta 5 vendedores",
      "PDF cliente + interno",
      "Calibrador de palancas",
      "Historial + Excel",
    ],
    cta: "Empezar Pro",
    featured: true,
  },
  {
    name: "Business",
    price: 4990,
    suffix: "/mes",
    description: "Multi-distribuidor con SLA dedicado.",
    features: ["Multi-distribuidor", "SSO + auditoría", "SLA dedicado"],
    cta: "Hablar con ventas",
    featured: false,
  },
];

function PricingTeaser() {
  return (
    <section id="pricing" className="py-32 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16 space-y-4"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
            Precios
          </span>
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900">
            Empieza gratis.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-cyan-500 to-pink-500">
              Crece sin permanencia.
            </span>
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Suscripción mensual en pesos. Sin tarjeta para los primeros días.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p, idx) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className={
                p.featured
                  ? "relative bg-white rounded-3xl border-2 border-indigo-500 p-8 shadow-2xl shadow-indigo-300/40 scale-[1.05] z-10"
                  : "relative bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:border-slate-300 hover:shadow-lg hover:shadow-indigo-100/30 transition-all"
              }
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-300/50">
                  Recomendado
                </div>
              )}
              <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                {p.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-5xl font-black text-slate-900 tracking-tight tabular-nums">
                  $
                  <NumberFlow
                    value={p.price}
                    format={{ maximumFractionDigits: 0 }}
                  />
                </span>
                <span className="text-sm text-slate-400">{p.suffix}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                {p.description}
              </p>
              <ul className="mt-6 space-y-3 mb-8">
                {p.features.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <CheckCircleIcon className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={
                  p.featured
                    ? "group relative inline-flex w-full items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold shadow-[0_12px_30px_-8px_rgba(79,70,229,0.5)] hover:shadow-[0_18px_40px_-8px_rgba(6,182,212,0.55)] hover:scale-[1.03] active:scale-95 transition-all overflow-hidden"
                    : "inline-flex w-full items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-slate-700 border border-slate-200 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-colors"
                }
              >
                {p.featured && (
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                )}
                <span className="relative">{p.cta}</span>
                <ArrowRightIcon className="relative w-4 h-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* FinalCTA — gradient diagonal indigo→cyan→pink                           */
/* ---------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-cyan-500 to-pink-500" />
      {/* Decorative shapes */}
      <FloatingBlob
        className="top-0 right-0 w-[40rem] h-[40rem] bg-white/15 translate-x-1/3 -translate-y-1/3"
        duration={28}
      />
      <FloatingBlob
        className="bottom-0 left-0 w-[32rem] h-[32rem] bg-black/10 -translate-x-1/3 translate-y-1/3"
        delay={2}
        duration={30}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-4xl mx-auto text-center text-white space-y-8"
      >
        <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]">
          Listo para vender{" "}
          <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-cyan-100">
            más rápido.
          </span>
        </h2>
        <p className="text-xl text-white/85 max-w-2xl mx-auto font-medium">
          Únete a los distribuidores que ya están en el futuro. Activación en 24 h,
          sin tarjeta de crédito.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/signup"
            className="group relative inline-flex items-center justify-center gap-2 px-10 py-5 rounded-full bg-white text-indigo-700 font-black text-lg shadow-[0_20px_50px_-12px_rgba(0,0,0,0.4)] hover:scale-105 active:scale-95 transition-all overflow-hidden"
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-indigo-200/50 to-transparent" />
            <span className="relative">Crear cuenta gratis</span>
            <ArrowRightIcon className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-10 py-5 rounded-full border-2 border-white/40 text-white font-semibold hover:bg-white/10 hover:border-white/60 transition-all"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <div className="pt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/80">
          <span className="inline-flex items-center gap-2">
            <ServerStackIcon className="w-4 h-4" />
            Datos en México
          </span>
          <span className="inline-flex items-center gap-2">
            <ClockIcon className="w-4 h-4" />
            Activación en 24 h
          </span>
          <span className="inline-flex items-center gap-2">
            <CurrencyDollarIcon className="w-4 h-4" />
            Cancela cuando quieras
          </span>
        </div>
      </motion.div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Footer                                                                  */
/* ---------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2 text-lg font-black tracking-tight">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-500 text-white">
            <BoltIcon className="w-3.5 h-3.5" />
          </span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-500">
            Lumina
          </span>
        </div>
        <div className="flex gap-6 text-sm">
          <Link href="/privacidad" className="text-slate-500 hover:text-indigo-600 transition-colors">
            Privacidad
          </Link>
          <Link href="/terminos" className="text-slate-500 hover:text-indigo-600 transition-colors">
            Términos
          </Link>
          <a href="mailto:hola@hectoria.mx" className="text-slate-500 hover:text-indigo-600 transition-colors">
            Contacto
          </a>
          <a href="mailto:soporte@hectoria.mx" className="text-slate-500 hover:text-indigo-600 transition-colors">
            Soporte
          </a>
        </div>
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <span>© 2026 Hectoria.</span>
          <span aria-hidden>MX</span>
        </div>
      </div>
    </footer>
  );
}
