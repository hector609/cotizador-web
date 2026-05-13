import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  MapPinIcon,
  ServerStackIcon,
} from "@/components/icons";

/* ---------------------------------------------------------------------- */
/* Precios — REVENTAR mode                                                 */
/* Dark glassmorphism premium, mismo lenguaje visual que landing.          */
/* Mesh radial gradient + grid pattern, glow shadows cyan, Geist 900.      */
/* ---------------------------------------------------------------------- */

const planes = [
  {
    nombre: "Starter",
    tagline: "Para el que vende solo y quiere recuperar la mañana.",
    precio: 499,
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
    tagline: "Para el equipo de 2 a 5 vendedores que ya no cabe en una hoja de Excel.",
    precio: 1299,
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
    nombre: "Business",
    tagline: "Para la operación que ya no puede permitirse cuellos de botella.",
    precio: 2999,
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

// Orden recomendado en copy/faq.md: 1, 2, 4, 3, 5, 6, 8, 7.
const faqs = [
  {
    q: "¿Cómo funciona el pago?",
    a: "Suscripción mensual en pesos mexicanos, sin compromiso de permanencia. Los primeros días son sin tarjeta: validamos tu RFC de distribuidor, te damos accesos y empiezas a cotizar; el cobro arranca al activar el plan. Cancelas cuando quieras desde tu cuenta y conservas el servicio hasta el fin del periodo pagado. Facturación CFDI disponible en Pro y Business.",
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
    a: "Sí, y de hecho ahí es donde más se nota la diferencia. Cada vendedor entra con su propio acceso y cotiza en paralelo sin pisarse con los demás; los datos quedan aislados por usuario y como dueño ves todo en un dashboard consolidado. El plan Pro incluye hasta 5 vendedores, Business no tiene tope. Si necesitas controlar permisos finos por vendedor, eso llega en la Fase 2 del roadmap.",
  },
  {
    q: "¿Puedo cancelar?",
    a: "Cuando quieras y sin llamar a nadie. Cancelas desde tu cuenta o respondiendo un email — el servicio sigue activo hasta el último día del ciclo que ya pagaste y después se desactiva, sin cargos extras ni \"letras chicas\". Si más adelante regresas, tu cartera de clientes y configuraciones siguen ahí 90 días por si te arrepientes.",
  },
  {
    q: "¿Hay soporte en español?",
    a: "Sí, soporte humano en español de México y en horario laboral CDMX (lun-vie 9-19h). Starter por email con respuesta en 24h hábiles; Pro con prioridad y respuesta el mismo día; Business con WhatsApp directo y onboarding 1-a-1. No tercerizamos soporte: te contesta alguien del equipo de Hectoria que conoce el producto.",
  },
  {
    q: "¿Qué pasa si el operador cambia los planes o el portal?",
    a: "Es parte del trabajo y por eso existimos: cuando el operador líder mueve algo (precios, palancas, formato de PDF, layout del portal), nosotros actualizamos el bot del lado del servidor — tú no haces nada. La mayoría de cambios los absorbemos en horas; los grandes (rediseño de portal) en días. Si algún día el operador cierra el acceso de distribuidores externos, te avisamos con tiempo y te devolvemos el último mes pagado.",
  },
];

export default function PreciosPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0b1326] text-white/90 antialiased overflow-x-hidden">
      <TopNav />
      <Hero />
      <PlanesSection />
      <RoadmapSection />
      <FaqSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* TopNav — idéntico a la landing                                          */
/* ---------------------------------------------------------------------- */

function TopNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[#0b1326]/70 backdrop-blur-md border-b border-white/10 shadow-[0_0_30px_rgba(6,182,212,0.08)]">
      <div className="max-w-7xl mx-auto px-4 md:px-16 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-black tracking-tight text-white hover:scale-105 hover:[text-shadow:0_0_20px_rgba(6,182,212,0.5)] transition-all"
        >
          Hectoria
        </Link>
        <div className="flex items-center gap-4 md:gap-8">
          <Link
            href="/precios"
            className="hidden sm:inline text-sm font-medium text-cyan-300 transition-colors"
          >
            Precios
          </Link>
          <Link
            href="/login"
            className="hidden sm:inline text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center text-sm font-semibold text-white px-5 py-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 hover:scale-105 hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all"
          >
            Probar gratis
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------------- */
/* Hero — mesh radial + grain texture                                      */
/* ---------------------------------------------------------------------- */

function Hero() {
  return (
    <section
      className="relative pt-32 pb-16 px-4 md:px-16 overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 0%, rgba(29, 78, 216, 0.18) 0%, transparent 50%),
          radial-gradient(circle at 80% 40%, rgba(45, 212, 191, 0.10) 0%, transparent 45%),
          radial-gradient(circle at 15% 70%, rgba(6, 182, 212, 0.10) 0%, transparent 40%),
          linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "auto, auto, auto, 40px 40px, 40px 40px",
      }}
    >
      <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-cyan-300/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-[0_0_20px_rgba(45,212,191,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
          Planes y precios · MXN sin IVA
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-white">
          Precios que crecen{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300">
            contigo.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
          Planes mensuales para distribuidores autorizados. Sin permanencia,
          cancela cuando quieras. Activación en 24 horas, sin tarjeta para
          empezar.
        </p>

        {/* Trust micro-row */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/50">
          <div className="inline-flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 text-cyan-300/70" />
            Datos en México
          </div>
          <div className="inline-flex items-center gap-2">
            <LockClosedIcon className="w-4 h-4 text-cyan-300/70" />
            Cifrado en tránsito
          </div>
          <div className="inline-flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-cyan-300/70" />
            Cancela cuando quieras
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* PlanesSection — 3 cards glassmorphism, Pro destacado scale-105          */
/* ---------------------------------------------------------------------- */

function PlanesSection() {
  return (
    <section className="py-16 md:py-24 px-4 md:px-16 bg-[#0b1326]">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {planes.map((p) => (
            <PlanCard key={p.nombre} plan={p} />
          ))}
        </div>

        <p className="text-center text-base text-white/70 mt-12 max-w-2xl mx-auto">
          Activación en 24 horas. Sin tarjeta para empezar la prueba — primero
          el bot funciona en tu operación, después hablamos de cobro.
        </p>
        <p className="text-center text-sm text-white/50 mt-3">
          ¿Volumen mayor o necesidades custom?{" "}
          <a
            href="https://instagram.com/hectoria.mx"
            target="_blank"
            rel="noopener"
            className="text-cyan-300 font-semibold hover:text-cyan-200 transition-colors"
          >
            Contáctanos
          </a>
        </p>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: (typeof planes)[number] }) {
  const isFeatured = plan.destacado;

  return (
    <div
      className={
        isFeatured
          ? "relative bg-gradient-to-br from-blue-600/20 to-cyan-400/10 backdrop-blur-md border border-cyan-300/40 rounded-2xl p-8 shadow-[0_0_30px_rgba(6,182,212,0.25)] md:scale-105 flex flex-col"
          : "relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-8 hover:border-white/20 hover:bg-white/[0.06] transition-colors flex flex-col"
      }
    >
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-[#0b1326] text-[10px] font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(45,212,191,0.5)]">
          Más popular
        </div>
      )}

      <h3 className="text-xl font-bold text-white tracking-tight">
        {plan.nombre}
      </h3>
      <p className="text-sm text-white/60 mt-1.5 leading-relaxed">
        {plan.tagline}
      </p>

      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-5xl font-black tabular-nums text-white tracking-tight">
          ${plan.precio.toLocaleString("es-MX")}
        </span>
        <span className="text-sm text-white/50">/mes</span>
      </div>
      <p className="text-[11px] text-white/40 mt-1">
        MXN sin IVA · Facturación CFDI en Pro y Business
      </p>

      <ul className="mt-7 space-y-3 flex-1">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2.5 text-sm text-white/80"
          >
            <CheckCircleIcon className="w-5 h-5 text-cyan-300 flex-shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        className={
          isFeatured
            ? "mt-8 block w-full text-center px-4 py-3 font-semibold rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 text-white hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all shadow-[0_0_40px_rgba(29,78,216,0.3)]"
            : "mt-8 block w-full text-center px-4 py-3 font-semibold rounded-full border border-white/15 text-white hover:bg-white/10 hover:border-white/30 transition-all"
        }
      >
        {plan.cta}
      </Link>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* RoadmapSection — fases glassmorphism                                    */
/* ---------------------------------------------------------------------- */

function RoadmapSection() {
  return (
    <section className="py-24 px-4 md:px-16 bg-[#060e20] border-y border-white/10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-300/10 border border-cyan-300/20 text-cyan-300 text-[11px] font-semibold uppercase tracking-wider">
            Roadmap 2026
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Hacia dónde vamos
          </h2>
          <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Construimos en público. Esto es lo que viene en los próximos meses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fases.map((f, idx) => (
            <div
              key={f.titulo}
              className="group bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-cyan-300/30 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 text-white flex items-center justify-center font-black font-mono shadow-[0_0_20px_rgba(6,182,212,0.35)]">
                  {idx + 1}
                </div>
                <div>
                  <h3 className="font-bold text-white tracking-tight">
                    {f.titulo}
                  </h3>
                  <p className="text-[10px] text-cyan-300/80 uppercase tracking-wider font-semibold mt-0.5">
                    {f.timing}
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {f.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-white/75"
                  >
                    <span className="text-cyan-300 font-bold mt-0.5">›</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* FaqSection — details glassmorphism dark                                 */
/* ---------------------------------------------------------------------- */

function FaqSection() {
  return (
    <section className="py-24 px-4 md:px-16 bg-[#0b1326]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-300/10 border border-cyan-300/20 text-cyan-300 text-[11px] font-semibold uppercase tracking-wider">
            Preguntas frecuentes
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Lo que más nos preguntan
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-5 open:border-cyan-300/30 open:bg-white/[0.06] open:shadow-[0_0_30px_rgba(6,182,212,0.12)] transition-all"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-white tracking-tight">
                <span>{item.q}</span>
                <span
                  className="text-cyan-300 text-xl ml-4 transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="text-white/70 text-sm mt-3 leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* FinalCTA — navy → cyan gradient (idéntico a landing)                    */
/* ---------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="relative py-28 px-4 md:px-16 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(135deg, #0b1326 0%, #0f2347 40%, #0e3a5f 70%, #0a4d6e 100%),
            radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.2) 0%, transparent 60%)
          `,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0b1326]/40 pointer-events-none" />
      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.05]">
          ¿Listo para empezar?{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 via-cyan-300 to-teal-300">
            Sin tarjeta.
          </span>
        </h2>
        <p className="text-lg text-white/70 max-w-2xl mx-auto">
          Únete a los distribuidores que ya cotizan con Hectoria. Validamos tu
          RFC, conectamos tus credenciales y cotizas el mismo día.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full bg-white text-[#0b1326] font-bold hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] active:scale-95 transition-all"
          >
            Comenzar ahora
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-10 py-4 rounded-full border border-white/20 text-white font-semibold hover:bg-white/10 hover:border-white/40 transition-all"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <div className="pt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/50">
          <div className="inline-flex items-center gap-2">
            <ServerStackIcon className="w-4 h-4 text-cyan-300/70" />
            Datos en México
          </div>
          <div className="inline-flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-cyan-300/70" />
            Activación en 24 h
          </div>
          <div className="inline-flex items-center gap-2">
            <CurrencyDollarIcon className="w-4 h-4 text-cyan-300/70" />
            Cancela cuando quieras
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Footer — idéntico a landing                                             */
/* ---------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="bg-[#060e20] border-t border-white/10 py-12 px-4 md:px-16">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-xl font-black tracking-tight text-white">
          Hectoria
        </div>
        <div className="text-sm text-white/50 text-center md:text-left">
          © 2026 Hectoria. Ingeniería mexicana para distribuidores autorizados.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <Link
            href="/precios"
            className="text-white/60 hover:text-white transition-colors"
          >
            Precios
          </Link>
          <Link
            href="/login"
            className="text-white/60 hover:text-white transition-colors"
          >
            Login
          </Link>
          <a
            href="https://hectoria.mx"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors"
          >
            hectoria.mx
          </a>
          <span className="text-white/40">México</span>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-6 text-[11px] text-white/35 text-center">
        No afiliado a operadores oficiales · Software para distribuidores
        autorizados
      </div>
    </footer>
  );
}
