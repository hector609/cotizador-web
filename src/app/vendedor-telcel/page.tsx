"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  BoltIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ClockIcon,
} from "@/components/icons";

/* ---------------------------------------------------------------------- */
/* /vendedor-telcel — Landing dedicado para vendedores internos Telcel     */
/* ---------------------------------------------------------------------- */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

export default function VendedorTelcelPage() {
  return (
    <main className="min-h-screen flex flex-col bg-white text-slate-900 antialiased overflow-x-hidden">
      <TopNav />
      <HeroSection />
      <BeforeAfterSection />
      <RoiCalculator />
      <FeaturesSection />
      <PriceSection />
      <FaqSection />
      <FinalCTA />
      <FooterSection />
    </main>
  );
}

/* TopNav ---------------------------------------------------------------- */
function TopNav() {
  return (
    <motion.nav
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_0_16px_rgba(251,146,60,0.4)]">
            <BoltIcon className="w-4 h-4" />
          </span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500">
            Lumina
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/precios" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Ver todos los planes
          </Link>
          <Link
            href="/signup?plan=vendedor_telcel"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold shadow-[0_6px_20px_-4px_rgba(251,146,60,0.5)] hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Empezar gratis
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

/* Hero ------------------------------------------------------------------ */
function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 55% at 50% 0%, rgba(251,146,60,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 80% 30%, rgba(251,146,60,0.08) 0%, transparent 55%)
          `,
        }}
      />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="relative z-10 max-w-4xl mx-auto text-center space-y-6"
      >
        <motion.div variants={fadeUp}>
          <motion.span
            animate={{ opacity: [1, 0.65, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400 text-white text-xs font-bold uppercase tracking-widest shadow-[0_4px_16px_rgba(251,146,60,0.4)]"
          >
            ⭐ OFERTA ESPECIAL DE LANZAMIENTO — $399/mes con IVA
          </motion.span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-900"
        >
          Cotiza{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500">
            10x más rápido
          </span>{" "}
          que tus compañeros
        </motion.h1>

        <motion.p variants={fadeUp} className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Sin abrir el portal de Telcel. Aria hace la cotización completa en 60 segundos — tú solo dices cuántas líneas y qué equipo.
        </motion.p>

        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Link
            href="/signup?plan=vendedor_telcel"
            className="group relative inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-[0_10px_30px_-6px_rgba(251,146,60,0.6)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <span className="relative">Empezar prueba gratis 14 días</span>
            <ArrowRightIcon className="w-5 h-5 relative" />
          </Link>
          <Link
            href="/precios"
            className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all duration-300"
          >
            Ver todos los planes
          </Link>
        </motion.div>

        <motion.p variants={fadeUp} className="text-sm text-slate-500">
          Sin tarjeta para empezar. Cancela cuando quieras.
        </motion.p>
      </motion.div>
    </section>
  );
}

/* Before/After ---------------------------------------------------------- */
function BeforeAfterSection() {
  return (
    <section className="py-20 px-6 bg-slate-50 border-y border-slate-200">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
          className="text-center mb-12 space-y-3"
        >
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold tracking-tight text-slate-900">
            Antes vs. Ahora
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-600">
            La misma cotización. La misma propuesta. La noche y el día.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Before */}
          <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <ClockIcon className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-bold text-red-700">Sin Aria — 15 min por cotización</h3>
            </div>
            <ul className="space-y-3">
              {[
                "Entrar al portal Telcel (si carga rápido)",
                "Navegar entre menús para encontrar el plan",
                "Configurar equipos uno por uno",
                "Calcular manualmente palancas y descuentos",
                "Exportar o copiar la propuesta a Word",
                "Enviar al cliente y esperar respuesta",
                "Repetir si el cliente pide ajuste",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <span className="text-red-400 font-bold mt-0.5">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 p-3 rounded-xl bg-red-50 text-center">
              <p className="text-2xl font-extrabold text-red-700">~15 min</p>
              <p className="text-xs text-red-500">por cotización (sin errores)</p>
            </div>
          </motion.div>

          {/* After */}
          <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <BoltIcon className="w-6 h-6 text-emerald-600" />
              <h3 className="text-lg font-bold text-emerald-700">Con Aria — 60 segundos</h3>
            </div>
            <ul className="space-y-3">
              {[
                "Abrir Telegram o la web app",
                "\"Cotiza 5 líneas con iPhone 16 Pro, plan ilimitado\"",
                "Aria configura el portal y genera el PDF",
                "Descargas el PDF oficial de Telcel",
                "Lo envías al cliente en segundos",
                "Aria guarda el historial automáticamente",
                "Ajuste = un mensaje más a Aria",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 p-3 rounded-xl bg-emerald-50 text-center">
              <p className="text-2xl font-extrabold text-emerald-700">~60 seg</p>
              <p className="text-xs text-emerald-600">por cotización con PDF incluido</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ROI Calculator -------------------------------------------------------- */
function RoiCalculator() {
  const [cotizaciones, setCotizaciones] = useState(30);
  const tiempoAhorradoMin = cotizaciones * 14; // ~14 min ahorrado por cotización
  const horasAhorradas = (tiempoAhorradoMin / 60).toFixed(1);
  const valorHora = 250; // MXN estimado para vendedor
  const valorAhorrado = Math.round((tiempoAhorradoMin / 60) * valorHora);
  const roi = Math.round(valorAhorrado - 399);

  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
          className="text-center mb-10 space-y-3"
        >
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold tracking-tight text-slate-900">
            Calcula tu ahorro
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-600">
            ¿Cuántas cotizaciones haces al mes?
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          className="bg-slate-50 rounded-3xl border border-slate-200 p-8 space-y-8"
        >
          {/* Slider */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-semibold text-slate-700">
              <span>Cotizaciones/mes</span>
              <span className="text-amber-600 text-xl">{cotizaciones}</span>
            </div>
            <input
              type="range"
              min={5}
              max={200}
              step={5}
              value={cotizaciones}
              onChange={(e) => setCotizaciones(Number(e.target.value))}
              className="w-full h-2 rounded-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>5/mes</span>
              <span>200/mes</span>
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Horas liberadas", value: horasAhorradas, unit: "h/mes", color: "text-indigo-700" },
              { label: "Valor del tiempo", value: `$${valorAhorrado.toLocaleString("es-MX")}`, unit: "MXN/mes", color: "text-emerald-700" },
              { label: "ROI neto", value: roi > 0 ? `+$${roi.toLocaleString("es-MX")}` : "$0", unit: "MXN/mes", color: "text-amber-700" },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{unit}</p>
                <p className="text-xs text-slate-600 font-semibold mt-1">{label}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 text-center">
            Basado en 14 min ahorrados por cotización vs. portal manual. Valor hora estimado $250 MXN.
          </p>

          <Link
            href="/signup?plan=vendedor_telcel"
            className="block text-center w-full py-3.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-[0_8px_24px_-6px_rgba(251,146,60,0.5)] hover:scale-[1.02] transition-all duration-300"
          >
            Empezar prueba gratis 14 días →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/* Features -------------------------------------------------------------- */
function FeaturesSection() {
  const features = [
    {
      icon: "⚡",
      title: "Bot Telegram + Web App",
      desc: "Cotiza desde el celular sin instalar nada. Telegram que ya tienes o la web desde cualquier navegador.",
    },
    {
      icon: "📄",
      title: "PDF oficial de Telcel",
      desc: "El PDF que genera Aria es el mismo que genera el portal — válido para presentar al cliente directo.",
    },
    {
      icon: "💬",
      title: "Aria AI conversacional",
      desc: "\"Cotiza 3 líneas iPhone 16, plan Business 50 GB\" — Aria entiende lenguaje natural y configura todo.",
    },
    {
      icon: "📊",
      title: "Historial completo",
      desc: "Todas tus cotizaciones guardadas, buscables por cliente, fecha, folio o equipo. Nunca más perder una propuesta.",
    },
    {
      icon: "🔄",
      title: "Ajustes en segundos",
      desc: "El cliente pide cambiar equipos o líneas. Un mensaje a Aria y tienes el PDF actualizado al instante.",
    },
    {
      icon: "🛡️",
      title: "Sin riesgo — cancela cuando quieras",
      desc: "Sin permanencia, sin letras chicas. Si decides que no es para ti, cancelas con un clic.",
    },
  ];

  return (
    <section className="py-20 px-6 bg-slate-50 border-y border-slate-200">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
          className="text-center mb-12 space-y-3"
        >
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold tracking-tight text-slate-900">
            Todo lo que incluye
          </motion.h2>
        </motion.div>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-50 transition-all duration-300"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* Price Section --------------------------------------------------------- */
function PriceSection() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
          className="space-y-6"
        >
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold tracking-tight text-slate-900">
            Precio de lanzamiento
          </motion.h2>

          <motion.div
            variants={fadeUp}
            className="relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl ring-4 ring-amber-400 shadow-2xl shadow-amber-500/30 p-10 overflow-hidden"
          >
            <motion.span
              animate={{ opacity: [1, 0.65, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400 text-white text-[11px] font-bold uppercase tracking-widest shadow-[0_4px_12px_rgba(251,146,60,0.4)] mb-6"
            >
              ⭐ OFERTA ESPECIAL
            </motion.span>

            <div className="flex items-baseline justify-center gap-3 mb-2">
              <span className="text-6xl font-extrabold text-slate-900">$399</span>
              <span className="text-2xl text-slate-400 line-through">$599</span>
              <span className="text-slate-500">/mes</span>
            </div>
            <p className="text-sm text-slate-500 mb-2">Precio incluye IVA 16%</p>
            <p className="text-sm text-amber-700 font-semibold mb-8">
              Cupo limitado para early adopters del lanzamiento
            </p>

            <Link
              href="/signup?plan=vendedor_telcel"
              className="group relative inline-flex items-center justify-center gap-2 w-full max-w-sm px-8 py-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-[0_10px_30px_-6px_rgba(251,146,60,0.6)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
            >
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <span className="relative">Empezar gratis 14 días</span>
              <ArrowRightIcon className="w-5 h-5 relative" />
            </Link>

            <p className="mt-4 text-sm text-slate-500">
              Sin tarjeta requerida durante el trial
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* FAQ ------------------------------------------------------------------- */
function FaqSection() {
  const faqs = [
    {
      q: "¿Es legal usar esto?",
      a: "Sí. Esta herramienta es un asistente de productividad personal para vendedores. Automatiza tu propio acceso al portal usando tus propias credenciales — igual que si lo hicieras tú manualmente, pero más rápido. No accede a datos de otros vendedores ni a sistemas restringidos.",
    },
    {
      q: "¿Telcel lo aprueba o sabe que lo uso?",
      a: "Lumina / Hectoria no tiene afiliación con Telcel ni requiere aprobación de Telcel para su uso. Es un software de terceros que automatiza tu flujo de trabajo personal con tus propias credenciales. Disclaimer: úsalo conforme a las políticas internas de tu empresa. Revisa con tu gerente si tienes dudas sobre las políticas de uso de herramientas de productividad.",
    },
    {
      q: "¿Necesito instalar algo?",
      a: "No. El bot vive en Telegram (que ya tienes) y la web app corre en cualquier navegador. Sin APK, sin extensión de Chrome, sin VPN.",
    },
    {
      q: "¿Qué pasa si cambian el portal de Telcel?",
      a: "Nos encargamos de actualizar el software del lado del servidor — tú no haces nada. La mayoría de cambios los absorbemos en horas.",
    },
    {
      q: "¿Puedo cancelar en cualquier momento?",
      a: "Sí, cuando quieras. Sin llamadas, sin letras chicas. El servicio sigue activo hasta el fin del periodo que pagaste.",
    },
    {
      q: "¿La prueba gratis requiere tarjeta?",
      a: "No. 14 días completamente gratis sin necesidad de tarjeta de crédito. Al terminar el trial decides si continúas.",
    },
  ];

  return (
    <section className="py-20 px-6 bg-slate-50 border-t border-slate-200">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
          className="text-center mb-12 space-y-3"
        >
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold tracking-tight text-slate-900">
            Preguntas frecuentes
          </motion.h2>
        </motion.div>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={stagger}
          className="space-y-3"
        >
          {faqs.map((item) => (
            <motion.details
              key={item.q}
              variants={fadeUp}
              className="group bg-white border border-slate-200 rounded-xl p-5 open:border-amber-300 open:shadow-lg transition-all duration-300"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-slate-900">
                <span>{item.q}</span>
                <span className="text-amber-500 text-xl ml-4 transition-transform duration-300 group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="text-slate-600 text-sm mt-3 leading-relaxed">{item.a}</p>
            </motion.details>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* Final CTA ------------------------------------------------------------- */
function FinalCTA() {
  return (
    <section className="relative py-24 px-6 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)" }}
      />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={stagger}
        className="relative z-10 max-w-3xl mx-auto text-center space-y-6"
      >
        <motion.h2 variants={fadeUp} className="text-5xl font-extrabold text-white tracking-tight">
          Cotiza tu primera propuesta hoy
        </motion.h2>
        <motion.p variants={fadeUp} className="text-lg text-white/85">
          14 días gratis. Sin tarjeta. Sin permanencia.
        </motion.p>
        <motion.div variants={fadeUp}>
          <Link
            href="/signup?plan=vendedor_telcel"
            className="group relative inline-flex items-center gap-2 px-10 py-4 rounded-full bg-white text-orange-600 font-bold text-lg shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-orange-100/60 to-transparent" />
            <span className="relative">Empezar prueba gratis</span>
            <ArrowRightIcon className="w-5 h-5 relative" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* Footer ---------------------------------------------------------------- */
function FooterSection() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2 font-black text-base">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 text-white">
            <BoltIcon className="w-3.5 h-3.5" />
          </span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500">Lumina</span>
        </div>
        <div className="flex gap-6">
          <Link href="/precios" className="hover:text-slate-900 transition-colors">Ver todos los planes</Link>
          <Link href="/login" className="hover:text-slate-900 transition-colors">Login</Link>
          <a href="https://hectoria.mx" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 transition-colors">hectoria.mx</a>
        </div>
        <p>© 2026 Hectoria · No afiliado a Telcel</p>
      </div>
      <div className="max-w-5xl mx-auto mt-5 text-[11px] text-slate-400 text-center">
        Disclaimer: Lumina es un software de productividad de terceros. No está afiliado, respaldado ni aprobado por Telcel o América Móvil. El uso de tus credenciales es exclusivamente para automatizar tu propio acceso al portal Telcel con tus propias cuentas. Revisa las políticas de uso de tu empresa antes de utilizar herramientas de automatización.
      </div>
    </footer>
  );
}
