"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useRef } from "react";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  LockClosedIcon,
  ServerStackIcon,
  ShieldCheckIcon,
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
      <PromoStrip />
      <TopNav />
      <Hero />
      <VendedorTelcelCard />
      <StatsBand />
      <LogosStrip />
      <NumberedFeatures />
      <PricingTeaser />
      <SecurePay />
      <FinalCTA />
      <Footer />
      <ConciergeWidget />
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* PromoStrip — amber/orange/pink top strip above nav                      */
/* ---------------------------------------------------------------------- */

function PromoStrip() {
  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 inset-x-0 z-[60] bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center">
        <motion.span
          animate={{ opacity: [1, 0.7, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-white text-xs sm:text-sm font-bold leading-snug"
        >
          <span className="mr-1">🌟</span>
          <span className="font-black">OFERTA ESPECIAL DE LANZAMIENTO:</span>{" "}
          Vendedor Telcel{" "}
          <span className="inline-block bg-white/25 rounded-full px-2 py-0.5 font-black">
            $399/mes
          </span>{" "}
          <span className="line-through opacity-75">$599</span> — solo primeros 100 cupos · 14 días gratis sin tarjeta
        </motion.span>
        <Link
          href="/vendedor-telcel"
          className="flex-shrink-0 inline-flex items-center gap-1 bg-white text-orange-600 font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-transform whitespace-nowrap"
        >
          Aprovechar
          <ArrowRightIcon className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
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
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
      className="fixed top-9 inset-x-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/60 shadow-sm"
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
      className="relative min-h-screen pt-40 pb-24 px-6 flex items-center overflow-hidden bg-white"
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

          {/* Trial info */}
          <motion.p
            variants={fadeUp}
            className="text-sm text-slate-500 max-w-2xl mx-auto"
          >
            Prueba gratis 14 días. Después $399/mes. Cancela cuando quieras.
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
              <span className="relative">Empieza gratis 14 días</span>
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
/* VendedorTelcelCard — card destacada post-hero                           */
/* ---------------------------------------------------------------------- */

function MiniChatMockup() {
  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl shadow-slate-900/30 text-left w-full max-w-xs mx-auto lg:mx-0">
      {/* Mac dots */}
      <div className="bg-slate-800 px-3 py-2 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 text-[10px] font-semibold text-slate-400">Aria · IA Agent</span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {/* user */}
        <div className="flex justify-end">
          <div className="bg-indigo-600 text-white text-[11px] leading-relaxed px-3 py-2 rounded-xl rounded-tr-sm max-w-[80%]">
            3 Samsung S25 Ultra, Plan 4000, 18 meses
          </div>
        </div>
        {/* typing indicator */}
        <div className="flex items-center gap-1.5 ml-1">
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-cyan-400"
          />
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
            className="w-1.5 h-1.5 rounded-full bg-cyan-400"
          />
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
            className="w-1.5 h-1.5 rounded-full bg-cyan-400"
          />
        </div>
        {/* agent response */}
        <div className="flex justify-start">
          <div className="bg-slate-700 text-slate-100 text-[11px] leading-relaxed px-3 py-2 rounded-xl rounded-tl-sm max-w-[85%]">
            Cotización lista en <span className="text-cyan-400 font-bold">2 min 14 seg</span>. Folio{" "}
            <span className="font-mono text-amber-300">#2381204</span> · Subsidio aplicado ✓
          </div>
        </div>
        {/* PDF row */}
        <div className="mt-1 flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
          <DocumentTextIcon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-400">PDF listo</div>
            <div className="text-[11px] text-white font-semibold truncate">Cotizacion_2381204.pdf</div>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">↓</span>
        </div>
      </div>
    </div>
  );
}

function VendedorTelcelCard() {
  const benefits = [
    "Importación automática de tu cartera Telcel",
    "Aria AI te cotiza por chat en lenguaje natural",
    "PDFs cliente + interno en segundos",
    "Comparte cotizaciones al instante vía link",
  ];

  return (
    <section className="relative py-16 px-6 bg-white overflow-hidden">
      {/* Subtle background glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(245,158,11,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-[2.5rem] overflow-hidden border-2 border-amber-300/60 bg-gradient-to-br from-white via-amber-50/60 to-orange-50/40 shadow-2xl shadow-amber-200/50 p-8 md:p-12"
        >
          {/* Top accent gradient bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500" />

          {/* Decorative blob */}
          <div
            aria-hidden
            className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-gradient-to-br from-amber-300/20 to-orange-300/20 blur-3xl pointer-events-none"
          />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left column — text */}
            <div className="space-y-6">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-300/40">
                  <span className="text-base">🌟</span> OFERTA ESPECIAL
                </span>
              </motion.div>

              {/* Heading */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="space-y-2"
              >
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  ¿Eres vendedor de{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500">
                    Telcel Empresas?
                  </span>
                </h2>
                <p className="text-lg text-slate-500 leading-relaxed max-w-lg">
                  Cotiza 10x más rápido sin abrir el portal. Aria hace el trabajo pesado mientras tú cierras la venta.
                </p>
              </motion.div>

              {/* Benefits */}
              <motion.ul
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={containerVariants}
                className="space-y-3"
              >
                {benefits.map((b) => (
                  <motion.li
                    key={b}
                    variants={fadeUp}
                    className="flex items-start gap-3"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mt-0.5 shadow-sm shadow-amber-300/40">
                      <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span className="text-slate-700 text-sm font-medium leading-relaxed">{b}</span>
                  </motion.li>
                ))}
              </motion.ul>

              {/* Pricing */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex items-baseline gap-3 pt-2"
              >
                <span className="text-5xl font-black text-slate-900 tracking-tight">$399</span>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-slate-400 line-through">$599</span>
                  <span className="text-sm text-slate-500 font-medium">/mes IVA incluido</span>
                </div>
                <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black border border-emerald-200">
                  Ahorra 33%
                </span>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="space-y-3"
              >
                <Link
                  href="/vendedor-telcel"
                  className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 text-white font-black text-base shadow-[0_14px_36px_-8px_rgba(245,158,11,0.55)] hover:shadow-[0_18px_44px_-8px_rgba(249,115,22,0.6)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  <span className="relative">Empezar GRATIS 14 días</span>
                  <ArrowRightIcon className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <p className="text-xs text-slate-400 font-medium">
                  Sin tarjeta requerida · Cancela cuando quieras · 100% mexicano
                </p>
              </motion.div>
            </div>

            {/* Right column — mini chat mockup + cupos chip */}
            <div className="flex flex-col items-center lg:items-start gap-4">
              <motion.div
                initial={{ opacity: 0, x: 30, rotate: 2 }}
                whileInView={{ opacity: 1, x: 0, rotate: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                className="w-full"
              >
                <MiniChatMockup />
              </motion.div>

              {/* Cupos chip */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-100 border border-amber-300/60 text-amber-800 text-xs font-bold shadow-sm"
              >
                <motion.span
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-amber-500"
                />
                87/100 cupos disponibles
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
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
/* PricingTeaser — 4 plan cards con NumberFlow                             */
/* ---------------------------------------------------------------------- */

type Plan = {
  name: string;
  price: number;
  originalPrice?: number;
  suffix: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  featured: boolean;
  badge?: string;
  badgeVariant?: "gold" | "indigo";
};

const plans: Plan[] = [
  {
    name: "Vendedor Telcel",
    price: 399,
    originalPrice: 599,
    suffix: "/mes IVA incluido",
    description: "Para vendedores individuales de Telcel Empresas. Cotiza 10x más rápido.",
    features: [
      "1 vendedor · cartera propia",
      "Cotizaciones ilimitadas vía chat",
      "PDF cliente + PDF interno",
      "14 días gratis sin tarjeta",
    ],
    cta: "Empezar GRATIS 14 días",
    ctaHref: "/vendedor-telcel",
    featured: true,
    badge: "OFERTA ESPECIAL",
    badgeVariant: "gold",
  },
  {
    name: "Starter",
    price: 999,
    suffix: "/mes IVA incluido",
    description: "Para equipos pequeños que cotizan a diario.",
    features: [
      "Hasta 3 vendedores",
      "PDF cliente + interno",
      "Historial filtrable",
    ],
    cta: "Empezar Starter",
    ctaHref: "/signup",
    featured: false,
  },
  {
    name: "Pro",
    price: 2499,
    suffix: "/mes IVA incluido",
    description: "Para distribuidores B2B con volumen alto.",
    features: [
      "Hasta 10 vendedores",
      "Calibrador de palancas",
      "Historial + Excel export",
      "Dashboard consolidado",
    ],
    cta: "Empezar Pro",
    ctaHref: "/signup",
    featured: false,
    badge: "Más popular",
    badgeVariant: "indigo",
  },
  {
    name: "Empresa",
    price: 4999,
    suffix: "/mes IVA incluido",
    description: "Multi-distribuidor con SLA dedicado y soporte prioritario.",
    features: [
      "Vendedores ilimitados",
      "Multi-distribuidor",
      "SSO + auditoría",
      "SLA dedicado",
    ],
    cta: "Hablar con ventas",
    ctaHref: "/signup",
    featured: false,
  },
];

function PricingTeaser() {
  return (
    <section id="pricing" className="py-32 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
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
            Suscripción mensual en pesos. Todos los precios IVA incluido. Sin tarjeta para los primeros 14 días.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
          {plans.map((p, idx) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className={
                p.featured
                  ? "relative flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 rounded-3xl border-2 border-amber-400/70 p-8 shadow-2xl shadow-amber-200/50 z-10 xl:scale-[1.04]"
                  : "relative flex flex-col bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:border-slate-300 hover:shadow-lg hover:shadow-indigo-100/30 transition-all"
              }
            >
              {/* Badge */}
              {p.badge && p.badgeVariant === "gold" && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-300/50 whitespace-nowrap">
                  {p.badge}
                </div>
              )}
              {p.badge && p.badgeVariant === "indigo" && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-300/50 whitespace-nowrap">
                  {p.badge}
                </div>
              )}

              <div className={`text-sm font-black uppercase tracking-widest ${p.featured ? "text-amber-600" : "text-slate-500"}`}>
                {p.name}
              </div>

              {/* Price */}
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className={`text-4xl font-black tracking-tight tabular-nums ${p.featured ? "text-orange-600" : "text-slate-900"}`}>
                  $<NumberFlow value={p.price} format={{ maximumFractionDigits: 0 }} />
                </span>
                {p.originalPrice && (
                  <span className="text-base font-bold text-slate-400 line-through tabular-nums">
                    ${p.originalPrice}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">{p.suffix}</div>

              <p className="mt-3 text-sm text-slate-500 leading-relaxed flex-grow">
                {p.description}
              </p>

              <ul className="mt-5 space-y-2.5 mb-8">
                {p.features.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <CheckCircleIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${p.featured ? "text-orange-500" : "text-cyan-500"}`} />
                    {feat}
                  </li>
                ))}
              </ul>

              <Link
                href={p.ctaHref}
                className={
                  p.featured
                    ? "group relative inline-flex w-full items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 text-white font-black shadow-[0_12px_30px_-8px_rgba(245,158,11,0.5)] hover:shadow-[0_18px_40px_-8px_rgba(249,115,22,0.55)] hover:scale-[1.03] active:scale-95 transition-all overflow-hidden"
                    : "inline-flex w-full items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-slate-700 border border-slate-200 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-colors"
                }
              >
                {p.featured && (
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                )}
                <span className="relative text-sm">{p.cta}</span>
                <ArrowRightIcon className="relative w-4 h-4" />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* CTA link to full pricing */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-10"
        >
          <Link
            href="/precios"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors group"
          >
            Ver todos los precios y comparar planes
            <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* SecurePay — trust section: Stripe + PCI-DSS + card logos               */
/* ---------------------------------------------------------------------- */

const secureFeatures = [
  {
    icon: CreditCardIcon,
    title: "Visa, Mastercard, AmEx, OXXO",
    desc: "Acepta todas las tarjetas mexicanas y pago en efectivo en OXXO.",
    gradient: "from-indigo-500 to-cyan-500",
  },
  {
    icon: ShieldCheckIcon,
    title: "Certificación PCI-DSS",
    desc: "El estándar más alto de la industria de pagos, auditado de forma independiente.",
    gradient: "from-cyan-500 to-emerald-500",
  },
  {
    icon: LockClosedIcon,
    title: "Encriptación 256-bit",
    desc: "Tus datos viajan cifrados de extremo a extremo en cada transacción.",
    gradient: "from-violet-500 to-indigo-500",
  },
  {
    icon: ArrowPathIcon,
    title: "Sin contratos",
    desc: "Cancela cuando quieras desde tu propio panel, sin penalizaciones ni letras chicas.",
    gradient: "from-pink-500 to-orange-500",
  },
] as const;

/* Stripe wordmark SVG (official simplified wordmark) */
function StripeWordmark({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Stripe"
      viewBox="0 0 60 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M5.464 9.777c0-.857.703-1.186 1.867-1.186 1.667 0 3.775.505 5.443 1.406V5.14C11.07 4.44 9.37 4.1 7.664 4.1 3.633 4.1 1 6.177 1 9.998c0 5.952 8.201 5.002 8.201 7.57 0 1.012-.877 1.34-2.104 1.34-1.819 0-4.153-.748-5.997-1.757V21.9c2.043.882 4.11 1.254 5.997 1.254 4.153 0 7.005-2.056 7.005-5.921-.022-6.43-8.638-5.284-8.638-7.456zM23.95 1l-4.65 9.909-.023-.044V1h-4.43v22.12h3.84l6.33-13.444L31.35 23.12h3.84V1h-4.43v9.865l-.023.044L26.087 1H23.95zM40.197 23.12h4.43V1h-4.43v22.12zM59 5.36V1h-13.6v22.12H59v-4.36h-9.17v-5.001H58.3v-4.143h-8.47V5.36H59z"
        fill="currentColor"
      />
    </svg>
  );
}

/* Visa logo — blue wordmark */
function VisaLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Visa"
      viewBox="0 0 48 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M18.6 0.5L12.2 15.5H8.1L5 3.8C4.8 3.1 4.6 2.8 4.1 2.5 3.2 2.1 1.7 1.6 0.5 1.3L0.6 0.5H7C7.9 0.5 8.6 1.1 8.8 2.1L10.4 10.6 14.5 0.5H18.6ZM35 10.7C35 6.8 29.4 6.6 29.4 4.9 29.4 4.3 30 3.7 31.2 3.6 31.8 3.5 33.4 3.5 35.2 4.3L35.9 1.1C35 0.8 33.9 0.5 32.5 0.5 28.6 0.5 25.8 2.6 25.8 5.7 25.8 8 27.9 9.3 29.5 10.1 31.1 10.9 31.6 11.4 31.6 12.1 31.6 13.2 30.3 13.6 29.1 13.7 27.1 13.7 26 13.1 25.1 12.7L24.3 16C25.3 16.4 26.9 16.8 28.6 16.8 32.8 16.8 35.5 14.7 35 10.7ZM44.8 15.5H48.5L45.3 0.5H41.9C41.1 0.5 40.4 1 40.1 1.7L34.2 15.5H38.3L39.1 13.2H44.2L44.8 15.5ZM40.2 10.1L42.3 4 43.5 10.1H40.2ZM24.1 0.5L20.9 15.5H17L20.2 0.5H24.1Z"
        fill="#1A1F71"
      />
    </svg>
  );
}

/* Mastercard logo — two overlapping circles */
function MastercardLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Mastercard"
      viewBox="0 0 38 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="11" cy="12" r="11" fill="#EB001B" />
      <circle cx="27" cy="12" r="11" fill="#F79E1B" />
      <path
        d="M19 4.54a11 11 0 000 14.92A11 11 0 0019 4.54z"
        fill="#FF5F00"
      />
    </svg>
  );
}

/* AmEx — simplified "AMEX" wordmark */
function AmexLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-label="American Express"
      viewBox="0 0 60 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="60" height="20" rx="3" fill="#2E77BC" />
      <text
        x="50%"
        y="14"
        textAnchor="middle"
        fill="white"
        fontSize="9"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        letterSpacing="1.5"
      >
        AMEX
      </text>
    </svg>
  );
}

function SecurePay() {
  return (
    <section className="relative py-24 px-6 bg-slate-50 border-y border-slate-100 overflow-hidden">
      {/* Subtle background gradient */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(79,70,229,0.05) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14 space-y-4"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
            Pagos
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
            Pago seguro con{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-500">
              Stripe
            </span>
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Procesamos pagos a través de Stripe — la misma tecnología que usan
            Amazon, Google y Shopify.
          </p>
        </motion.div>

        {/* Feature tiles — 2x2 mobile, 1x4 desktop */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-14"
        >
          {secureFeatures.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={{ scale: 1.05, y: -4 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="relative flex flex-col gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 transition-shadow"
              >
                {/* Icon badge */}
                <span
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${f.gradient} text-white shadow-md flex-shrink-0`}
                >
                  <Icon className="w-6 h-6" />
                </span>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-sm leading-snug">
                    {f.title}
                  </p>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Logos strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col items-center gap-6"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Procesadores aceptados
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {/* Stripe wordmark */}
            <div className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <StripeWordmark className="h-6 text-[#635BFF]" />
            </div>
            {/* Visa */}
            <div className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <VisaLogo className="h-5" />
            </div>
            {/* Mastercard */}
            <div className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <MastercardLogo className="h-7" />
            </div>
            {/* AmEx */}
            <div className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <AmexLogo className="h-6 w-16" />
            </div>
          </div>

          {/* Legal footnote */}
          <p className="text-xs text-slate-400 text-center max-w-xl leading-relaxed">
            Stripe está autorizado por la Comisión Nacional Bancaria y de Valores
            (CNBV) en México. Nunca almacenamos datos de tu tarjeta en nuestros
            servidores.
          </p>
        </motion.div>
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
