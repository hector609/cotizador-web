"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import NumberFlow from "@number-flow/react";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  MapPinIcon,
  ServerStackIcon,
} from "@/components/icons";
import { ConciergeWidget } from "@/components/concierge/ConciergeWidget";

/* ---------------------------------------------------------------------- */
/* Precios — LUMINA Light Premium                                          */
/* White surface, indigo/cyan/pink gradients, pill buttons, NumberFlow     */
/* monthly↔yearly toggle, framer-motion stagger, shimmer effects.          */
/* ---------------------------------------------------------------------- */

type Billing = "monthly" | "yearly";

interface Plan {
  nombre: string;
  tagline: string;
  price: number; // /mes en MXN
  yearlyPrice: number; // /año en MXN (price * 12 * 0.85, redondeado)
  destacado: boolean;
  cta: string;
  features: string[];
}

const planes: Plan[] = [
  {
    nombre: "Starter",
    tagline:
      "Para el que vende solo y quiere recuperar la mañana.",
    price: 99,
    yearlyPrice: Math.round(99 * 12 * 0.85),
    destacado: false,
    cta: "Empezar prueba",
    features: [
      "Bot Telegram + Web App",
      "1 usuario vendedor",
      "Hasta 100 cotizaciones/mes",
      "Multi-cliente en cartera",
      "PDFs oficiales",
      "Soporte por email",
    ],
  },
  {
    nombre: "Pro",
    tagline:
      "Para el equipo de 2 a 5 vendedores que ya no cabe en una hoja de Excel.",
    price: 299,
    yearlyPrice: Math.round(299 * 12 * 0.85),
    destacado: true,
    cta: "Probar Pro 14 días",
    features: [
      "Todo lo de Starter +",
      "Hasta 5 vendedores",
      "500 cotizaciones/mes",
      "Calibrador A/B automático",
      "Dashboard con métricas",
      "Facturación CFDI",
      "Soporte prioritario",
    ],
  },
  {
    nombre: "Empresa",
    tagline:
      "Para la operación que ya no puede permitirse cuellos de botella.",
    price: 999,
    yearlyPrice: Math.round(999 * 12 * 0.85),
    destacado: false,
    cta: "Hablar con ventas",
    features: [
      "Todo lo de Pro +",
      "Vendedores ilimitados",
      "Cotizaciones ilimitadas",
      "Subdominio personalizado (próximamente)",
      "Branding propio (próximamente)",
      "Facturación CFDI",
      "Soporte 24/7 + onboarding",
    ],
  },
];

const fases = [
  {
    titulo: "Fase 1 — Quick Wins",
    timing: "Esta semana",
    items: [
      "Self-service onboarding via /registrar",
      "Métricas de uso por tenant",
      "Alertas push cuando algo falla",
      "Plantillas personalizadas",
    ],
  },
  {
    titulo: "Fase 2 — Web App PWA",
    timing: "Mes 1",
    items: [
      "App responsive instalable",
      "Login Telegram + magic link",
      "Form cotización web completo",
      "Historial + descarga PDFs",
    ],
  },
  {
    titulo: "Fase 3 — White-label SaaS",
    timing: "Meses 2-4",
    items: [
      "Subdominios por distribuidor",
      "Branding custom (logo + colores)",
      "Stripe + facturación CFDI",
      "Landing pública + signup",
      "APK Android",
    ],
  },
  {
    titulo: "Fase 4 — Escala nacional",
    timing: "Mes 12",
    items: [
      "Red de distribuidores en todo México",
      "Integraciones nativas con CRMs",
      "API pública para automatizaciones",
      "Comunidad y eventos para distribuidores",
    ],
  },
];

const faqs = [
  {
    q: "¿Cómo funciona el pago?",
    a: "Suscripción mensual en pesos mexicanos, sin compromiso de permanencia. Los primeros días son sin tarjeta: validamos tu RFC de distribuidor, te damos accesos y empiezas a cotizar; el cobro arranca al activar el plan. Cancelas cuando quieras desde tu cuenta y conservas el servicio hasta el fin del periodo pagado. Facturación CFDI disponible en Pro y Empresa.",
  },
  {
    q: "¿Qué pasa si excedo las cotizaciones del plan?",
    a: "Te avisamos al llegar al 80% del límite y otra vez al 100%, siempre con la opción de hacer upgrade en un clic. Si te pasaste un mes puntual no te cortamos el bot a media cotización: te dejamos terminar las que tienes en curso y al cierre del ciclo decides si subes de plan o sigues igual. Nunca cobramos overages sorpresa.",
  },
  {
    q: "¿Necesito instalar algo?",
    a: "No. El bot vive en Telegram (que probablemente ya tienes) y el dashboard corre en cualquier navegador moderno. No hay APK que instalar, ni extensión de Chrome, ni VPN, ni cliente de escritorio. Si tu equipo usa celulares Android o iPhone, ya tienen todo lo que necesitan.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Servidores en México, cifrado en tránsito (HTTPS/TLS) en todo el flujo, y aislamiento por tenant: cada distribuidor solo ve sus propias credenciales y cartera. Tu RFC y los de tus clientes nunca se exponen en logs públicos ni se comparten con terceros — los datos sensibles van enmascarados en las trazas. No vendemos ni cruzamos información entre cuentas.",
  },
  {
    q: "¿Funciona si tengo varios vendedores?",
    a: "Sí, y de hecho ahí es donde más se nota la diferencia. Cada vendedor entra con su propio acceso y cotiza en paralelo sin pisarse con los demás; los datos quedan aislados por usuario y como dueño ves todo en un dashboard consolidado. El plan Pro incluye hasta 5 vendedores, Empresa no tiene tope. Si necesitas controlar permisos finos por vendedor, eso llega en la Fase 2 del roadmap.",
  },
  {
    q: "¿Puedo cancelar?",
    a: "Cuando quieras y sin llamar a nadie. Cancelas desde tu cuenta o respondiendo un email — el servicio sigue activo hasta el último día del ciclo que ya pagaste y después se desactiva, sin cargos extras ni \"letras chicas\". Si más adelante regresas, tu cartera de clientes y configuraciones siguen ahí 90 días por si te arrepientes.",
  },
  {
    q: "¿Hay soporte en español?",
    a: "Sí, soporte humano en español de México y en horario laboral CDMX (lun-vie 9-19h). Starter por email con respuesta en 24h hábiles; Pro con prioridad y respuesta el mismo día; Empresa con WhatsApp directo y onboarding 1-a-1. No tercerizamos soporte: te contesta alguien del equipo de Hectoria que conoce el producto.",
  },
  {
    q: "¿Qué pasa si el operador cambia los planes o el portal?",
    a: "Es parte del trabajo y por eso existimos: cuando el operador líder mueve algo (precios, palancas, formato de PDF, layout del portal), nosotros actualizamos el bot del lado del servidor — tú no haces nada. La mayoría de cambios los absorbemos en horas; los grandes (rediseño de portal) en días. Si algún día el operador cierra el acceso de distribuidores externos, te avisamos con tiempo y te devolvemos el último mes pagado.",
  },
];

/* Motion variants -------------------------------------------------------- */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const cardsContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const cardItem: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const featureItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.35 },
  }),
  exit: { opacity: 0, x: 8, transition: { duration: 0.2 } },
};

/* ---------------------------------------------------------------------- */

export default function PreciosPage() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <main className="min-h-screen flex flex-col bg-white text-slate-900 antialiased overflow-x-hidden">
      <TopNav />
      <Hero billing={billing} setBilling={setBilling} />
      <PlanesSection billing={billing} />
      <RoadmapSection />
      <FaqSection />
      <FinalCTA />
      <Footer />
      <ConciergeWidget />
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* TopNav — reuse landing style                                            */
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
          <Link
            href="/#features"
            className="text-slate-600 hover:text-indigo-600 transition-colors"
          >
            Producto
          </Link>
          <Link
            href="/precios"
            className="text-indigo-600 font-semibold"
          >
            Precios
          </Link>
          <Link
            href="/login"
            className="text-slate-600 hover:text-indigo-600 transition-colors"
          >
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
/* Hero — H1 + subhead + billing pill toggle                                */
/* ---------------------------------------------------------------------- */

function Hero({
  billing,
  setBilling,
}: {
  billing: Billing;
  setBilling: (b: Billing) => void;
}) {
  return (
    <section className="relative pt-32 pb-12 px-6 overflow-hidden bg-white">
      {/* Soft radial accent */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[480px] pointer-events-none opacity-70"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 50% 0%, rgba(79,70,229,0.10) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 80% 30%, rgba(6,182,212,0.10) 0%, transparent 55%),
            radial-gradient(ellipse 40% 40% at 15% 30%, rgba(236,72,153,0.08) 0%, transparent 55%)
          `,
        }}
      />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
        }}
        className="relative z-10 max-w-3xl mx-auto text-center space-y-6"
      >
        <motion.div variants={fadeUp}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold uppercase tracking-wider shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            Planes y precios · MXN sin IVA
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-900"
        >
          Precios
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
        >
          Planes mensuales para distribuidores autorizados. Sin permanencia,
          cancela cuando quieras. Activación en 24 horas, sin tarjeta para
          empezar.
        </motion.p>

        {/* Billing pill toggle */}
        <motion.div variants={fadeUp} className="pt-2 flex justify-center">
          <BillingPill billing={billing} setBilling={setBilling} />
        </motion.div>

        {/* Trust micro-row */}
        <motion.div
          variants={fadeUp}
          className="pt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500"
        >
          <div className="inline-flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 text-indigo-500" />
            Datos en México
          </div>
          <div className="inline-flex items-center gap-2">
            <LockClosedIcon className="w-4 h-4 text-indigo-500" />
            Cifrado en tránsito
          </div>
          <div className="inline-flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
            Cancela cuando quieras
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function BillingPill({
  billing,
  setBilling,
}: {
  billing: Billing;
  setBilling: (b: Billing) => void;
}) {
  return (
    <div className="relative inline-flex items-center rounded-full bg-slate-100 border border-slate-200 p-1 shadow-inner">
      {(["monthly", "yearly"] as const).map((value) => {
        const isActive = billing === value;
        const label = value === "monthly" ? "Mensual" : "Anual (-15%)";
        return (
          <button
            key={value}
            type="button"
            onClick={() => setBilling(value)}
            className={`relative z-10 px-5 py-2 rounded-full text-sm font-semibold transition-colors duration-300 ${
              isActive ? "text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="billing-pill"
                className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-[0_8px_24px_-6px_rgba(79,70,229,0.55)]"
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* PlanesSection — 3 cards stagger + NumberFlow + hover scale              */
/* ---------------------------------------------------------------------- */

function PlanesSection({ billing }: { billing: Billing }) {
  return (
    <section className="py-16 md:py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={cardsContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch"
        >
          {planes.map((p) => (
            <motion.div key={p.nombre} variants={cardItem}>
              <PlanCard plan={p} billing={billing} />
            </motion.div>
          ))}
        </motion.div>

        <p className="text-center text-base text-slate-600 mt-12 max-w-2xl mx-auto">
          Activación en 24 horas. Sin tarjeta para empezar la prueba — primero
          el bot funciona en tu operación, después hablamos de cobro.
        </p>
        <p className="text-center text-sm text-slate-500 mt-3">
          ¿Volumen mayor o necesidades custom?{" "}
          <a
            href="https://instagram.com/hectoria.mx"
            target="_blank"
            rel="noopener"
            className="text-indigo-600 font-semibold hover:text-cyan-600 transition-colors"
          >
            Contáctanos
          </a>
        </p>
      </div>
    </section>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const isFeatured = plan.destacado;
  const value = billing === "monthly" ? plan.price : plan.yearlyPrice;
  const periodLabel = billing === "monthly" ? "/mes" : "/año";

  return (
    <motion.div
      initial={false}
      animate={{ scale: isFeatured ? 1.05 : 1 }}
      whileHover={{
        scale: isFeatured ? 1.07 : 1.02,
        transition: { duration: 0.25, ease: "easeOut" },
      }}
      className={
        isFeatured
          ? "group relative h-full bg-white rounded-3xl border border-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,0.2),0_20px_50px_-12px_rgba(79,70,229,0.35)] hover:shadow-[0_0_0_1px_rgba(99,102,241,0.3),0_30px_70px_-12px_rgba(99,102,241,0.45)] p-8 flex flex-col transition-shadow duration-300 overflow-hidden"
          : "group relative h-full bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-indigo-200/40 hover:border-indigo-200 p-8 flex flex-col transition-all duration-300 overflow-hidden"
      }
    >
      {/* Subtle shimmer overlay on hover */}
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-indigo-50/40 to-transparent pointer-events-none"
      />

      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-[0_4px_20px_rgba(45,212,191,0.5)]">
          Más popular
        </div>
      )}

      <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
        {plan.nombre}
      </h3>
      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
        {plan.tagline}
      </p>

      <div className="mt-6 flex items-baseline gap-1.5">
        <NumberFlow
          value={value}
          format={{
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
          }}
          locales="es-MX"
          className="text-5xl font-extrabold tabular-nums text-slate-900 tracking-tight"
        />
        <span className="text-sm text-slate-500">{periodLabel}</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">
        MXN sin IVA · Facturación CFDI en Pro y Empresa
      </p>

      <ul className="mt-7 space-y-3 flex-1">
        <AnimatePresence mode="wait">
          {plan.features.map((f, i) => (
            <motion.li
              key={`${billing}-${f}`}
              custom={i}
              variants={featureItem}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex items-start gap-2.5 text-sm text-slate-700"
            >
              <CheckCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{f}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <Link
        href="/signup"
        className={
          isFeatured
            ? "group/cta relative mt-8 inline-flex items-center justify-center w-full px-4 py-3 font-semibold rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white hover:scale-[1.02] active:scale-95 shadow-[0_8px_24px_-6px_rgba(79,70,229,0.55)] hover:shadow-[0_10px_30px_-4px_rgba(6,182,212,0.55)] transition-all duration-300 overflow-hidden"
            : "group/cta relative mt-8 inline-flex items-center justify-center w-full px-4 py-3 font-semibold rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-300"
        }
      >
        {isFeatured && (
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full group-hover/cta:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />
        )}
        <span className="relative">{plan.cta}</span>
      </Link>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* RoadmapSection — fases tarjetas blancas                                 */
/* ---------------------------------------------------------------------- */

function RoadmapSection() {
  return (
    <section className="py-24 px-6 bg-slate-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
          className="text-center mb-14 space-y-4"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 text-[11px] font-semibold uppercase tracking-wider shadow-sm">
              Roadmap 2026
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900"
          >
            Hacia dónde vamos
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed"
          >
            Construimos en público. Esto es lo que viene en los próximos meses.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={cardsContainer}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {fases.map((f, idx) => (
            <motion.div
              key={f.titulo}
              variants={cardItem}
              whileHover={{ y: -4 }}
              className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/40 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center font-black font-mono shadow-[0_8px_20px_-6px_rgba(79,70,229,0.45)]">
                  {idx + 1}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 tracking-tight">
                    {f.titulo}
                  </h3>
                  <p className="text-[10px] text-indigo-600/80 uppercase tracking-wider font-semibold mt-0.5">
                    {f.timing}
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {f.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <span className="text-cyan-500 font-bold mt-0.5">›</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* FaqSection — details Light + chevron animado                            */
/* ---------------------------------------------------------------------- */

function FaqSection() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
          className="text-center mb-12 space-y-4"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold uppercase tracking-wider shadow-sm">
              Preguntas frecuentes
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900"
          >
            Lo que más nos preguntan
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={cardsContainer}
          className="space-y-3"
        >
          {faqs.map((item) => (
            <motion.details
              key={item.q}
              variants={cardItem}
              className="group bg-slate-50 border border-slate-200 rounded-xl p-5 open:border-indigo-200 open:bg-white open:shadow-lg open:shadow-indigo-100/40 transition-all duration-300"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-slate-900 tracking-tight">
                <span>{item.q}</span>
                <span
                  className="text-indigo-600 text-xl ml-4 transition-transform duration-300 group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="text-slate-600 text-sm mt-3 leading-relaxed">
                {item.a}
              </p>
            </motion.details>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* FinalCTA — gradient strip indigo→cyan→pink                              */
/* ---------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="relative py-24 px-6 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(135deg, #4F46E5 0%, #06B6D4 55%, #EC4899 100%)
          `,
        }}
      />
      {/* Subtle grain / radial highlight */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.25) 0%, transparent 60%)",
        }}
      />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
        }}
        className="relative z-10 max-w-4xl mx-auto text-center space-y-8"
      >
        <motion.h2
          variants={fadeUp}
          className="text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.05]"
        >
          ¿Listo para empezar?{" "}
          <span className="text-white/90">Sin tarjeta.</span>
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="text-lg text-white/85 max-w-2xl mx-auto"
        >
          Únete a los distribuidores que ya cotizan con Hectoria. Validamos tu
          RFC, conectamos tus credenciales y cotizas el mismo día.
        </motion.p>
        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row justify-center gap-4 pt-2"
        >
          <Link
            href="/signup"
            className="group relative inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full bg-white text-indigo-700 font-bold hover:scale-105 active:scale-95 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)] transition-all duration-300 overflow-hidden"
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-indigo-100/60 to-transparent" />
            <span className="relative">Comenzar ahora</span>
            <ArrowRightIcon className="w-4 h-4 relative" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-10 py-4 rounded-full border border-white/40 text-white font-semibold hover:bg-white/10 hover:border-white/60 transition-all duration-300"
          >
            Ya tengo cuenta
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/75"
        >
          <div className="inline-flex items-center gap-2">
            <ServerStackIcon className="w-4 h-4 text-white/80" />
            Datos en México
          </div>
          <div className="inline-flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-white/80" />
            Activación en 24 h
          </div>
          <div className="inline-flex items-center gap-2">
            <CurrencyDollarIcon className="w-4 h-4 text-white/80" />
            Cancela cuando quieras
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Footer — minimal light                                                  */
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
          <Link
            href="/precios"
            className="text-slate-500 hover:text-indigo-600 transition-colors"
          >
            Precios
          </Link>
          <Link
            href="/login"
            className="text-slate-500 hover:text-indigo-600 transition-colors"
          >
            Login
          </Link>
          <a
            href="https://hectoria.mx"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-indigo-600 transition-colors"
          >
            hectoria.mx
          </a>
        </div>
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <span>© 2026 Hectoria.</span>
          <span aria-hidden>MX</span>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-6 text-[11px] text-slate-400 text-center">
        No afiliado a operadores oficiales · Software para distribuidores
        autorizados
      </div>
    </footer>
  );
}
