import Link from "next/link";
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

/* ---------------------------------------------------------------------- */
/* Landing — REVENTAR mode                                                 */
/* Dark glassmorphism premium. Mesh gradient backgrounds, glow shadows,    */
/* numbered features Linear-style, stats band, gradient CTA.               */
/* ---------------------------------------------------------------------- */

const features = [
  {
    n: "01",
    icon: ChatBubbleLeftRightIcon,
    title: "Cotiza por chat",
    desc: "Escribe en español natural: cuántas líneas, qué plan, qué equipo. El motor abre el portal por ti, aplica las palancas y arma la cotización mientras tomas otra llamada.",
  },
  {
    n: "02",
    icon: ChartBarIcon,
    title: "Optimiza palancas",
    desc: "El calibrador detecta la combinación de descuentos y subsidios que cumple tu rentabilidad objetivo sin romper reglas del operador.",
  },
  {
    n: "03",
    icon: UsersIcon,
    title: "Multi-distribuidor",
    desc: "Cada vendedor entra con sus credenciales y cotiza en paralelo. Tú ves todo el equipo desde un dashboard consolidado por RFC, vendedor y fecha.",
  },
  {
    n: "04",
    icon: DocumentTextIcon,
    title: "Historial + PDF",
    desc: "Doble salida en cada cotización: PDF oficial para el cliente y PDF interno con margen real. Todo el histórico filtrable y exportable.",
  },
];

const stats = [
  { value: "2:14", label: "Min / cotización", accent: "text-white" },
  { value: "18.4%", label: "Aumento de margen", accent: "text-cyan-300" },
  { value: "99.8%", label: "Uptime consola", accent: "text-white" },
  { value: "$48M", label: "MXN procesados", accent: "text-white" },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0b1326] text-white/90 antialiased overflow-x-hidden">
      <TopNav />
      <Hero />
      <LogosStrip />
      <NumberedFeatures />
      <StatsBand />
      <PricingTeaser />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* TopNav                                                                  */
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
            className="hidden sm:inline text-sm font-medium text-white/70 hover:text-white transition-colors"
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
/* Hero                                                                    */
/* ---------------------------------------------------------------------- */

function Hero() {
  return (
    <section
      className="relative pt-32 pb-24 px-4 md:px-16 overflow-hidden"
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
      <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
        {/* Eyebrow pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-cyan-300/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-[0_0_20px_rgba(45,212,191,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
          Nuevo · Cotiza Telcel sin Excel
        </div>

        {/* H1 */}
        <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] text-white">
          La cotización Telcel que no te{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300">
            roba tu mañana.
          </span>
        </h1>

        {/* Subhead */}
        <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
          La consola inteligente para distribuidores Telcel que elimina errores
          manuales y optimiza cada margen.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 text-white font-semibold hover:scale-105 hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all shadow-[0_0_40px_rgba(29,78,216,0.3)]"
          >
            Probar gratis
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
          <Link
            href="/precios"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-full border border-white/15 text-white font-semibold hover:bg-white/5 hover:border-white/30 transition-all"
          >
            Ver precios
          </Link>
        </div>

        {/* Microproof */}
        <div className="pt-6 text-sm text-white/50">
          12+ distribuidores activos · 1,800+ cotizaciones/mes · 99.8% uptime
        </div>
      </div>

      {/* Product Mockup */}
      <div className="relative mt-20 max-w-5xl mx-auto z-10">
        <ChatMockup />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* ChatMockup — slice REAL del producto con folio 2378845 + palancas       */
/* ---------------------------------------------------------------------- */

function ChatMockup() {
  return (
    <div className="relative">
      {/* Floating folio badge — top-left */}
      <div className="hidden md:flex absolute -top-6 -left-6 z-20 items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[#0b1326]">
          <CheckCircleIcon className="w-5 h-5" />
        </span>
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold leading-none">
            Folio
          </div>
          <div className="text-sm font-mono font-semibold text-white leading-tight">
            2378845
          </div>
        </div>
      </div>

      {/* Floating palancas card — right side */}
      <div className="hidden lg:block absolute -right-6 top-1/3 z-20 w-60 bg-white/5 backdrop-blur-md border border-cyan-300/20 rounded-2xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] rotate-3">
        <div className="flex items-center gap-2 mb-3">
          <BoltIcon className="w-5 h-5 text-cyan-300" />
          <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            Palancas
          </div>
        </div>
        <ul className="space-y-2 text-xs text-white/80">
          <li className="flex items-center justify-between">
            <span>Descuento equipo</span>
            <span className="font-mono font-semibold text-white">35%</span>
          </li>
          <li className="flex items-center justify-between">
            <span>A/B mensual</span>
            <span className="font-mono font-semibold text-white">92%</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Plazo</span>
            <span className="font-mono font-semibold text-white">24 m</span>
          </li>
        </ul>
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-emerald-300">
          <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
          +18.4% margen
        </div>
      </div>

      {/* Main chat card */}
      <div className="relative z-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(6,182,212,0.15)]">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 h-9 border-b border-white/10 bg-white/[0.03]">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          <div className="ml-4 text-xs text-white/40 font-mono">
            cotizador.hectoria.mx / chat
          </div>
        </div>

        {/* Chat body */}
        <div className="p-6 md:p-8 space-y-5 text-left">
          {/* User bubble */}
          <div className="flex justify-end">
            <div className="max-w-[80%] bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl rounded-tr-md px-5 py-3 text-sm leading-relaxed shadow-lg">
              Necesito 5 iPhone 17 Pro Max, plan Max Sin Límite 6000, 24 meses,
              para RFC OAX140324HE7.
            </div>
          </div>

          {/* Assistant bubble */}
          <div className="flex justify-start gap-3">
            <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-cyan-300 to-teal-400 text-[#0b1326] text-[10px] font-bold mt-1">
              AI
            </span>
            <div className="max-w-[80%] bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl rounded-tl-md px-5 py-3 text-sm text-white/85 leading-relaxed">
              Listo. Cotizo 5 líneas con iPhone 17 Pro Max, Max Sin Límite 6000,
              24 meses para{" "}
              <span className="font-mono font-semibold text-cyan-300">
                OAX140324HE7
              </span>
              . El calibrador propone aplicar palanca{" "}
              <strong className="text-white">A/B 92%</strong> para cumplir tu
              rentabilidad objetivo.
            </div>
          </div>

          {/* Cotización lista card */}
          <div className="ml-11 bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4 shadow-[0_0_40px_rgba(29,78,216,0.15)]">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                <DocumentTextIcon className="w-5 h-5 text-white" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-bold text-white leading-tight">
                  Cotización lista
                </div>
                <div className="text-xs text-white/50 mt-0.5">
                  5 líneas · 24 meses · A/B 92%
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-400/15 text-emerald-300 border border-emerald-300/20">
                Completada
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                  Total mensual
                </div>
                <div className="text-xl font-bold text-white font-mono mt-1">
                  $80,067.50
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                  Margen
                </div>
                <div className="text-xl font-bold font-mono mt-1 text-emerald-300">
                  18.4%
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2.5 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <DocumentTextIcon className="w-3.5 h-3.5" />
                PDF cliente
              </span>
              <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white/80 bg-white/5 border border-white/10 px-3 py-2.5 rounded-lg">
                <DocumentTextIcon className="w-3.5 h-3.5" />
                PDF interno
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* LogosStrip                                                              */
/* ---------------------------------------------------------------------- */

function LogosStrip() {
  return (
    <section className="py-14 border-y border-white/10 bg-[#060e20]">
      <div className="max-w-7xl mx-auto px-4 md:px-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-8">
          Distribuidores que confían
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-6 opacity-50 hover:opacity-80 transition-opacity duration-500">
          {["CeluMaster", "Huvasi", "DistriTel", "Connecta", "RedMóvil"].map(
            (name) => (
              <div
                key={name}
                className="text-lg md:text-xl font-bold tracking-tight text-white/70 hover:text-white transition-colors"
              >
                {name}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* NumberedFeatures — Linear style                                         */
/* ---------------------------------------------------------------------- */

function NumberedFeatures() {
  return (
    <section className="py-32 px-4 md:px-16 bg-[#0b1326]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-300/10 border border-cyan-300/20 text-cyan-300 text-[11px] font-semibold uppercase tracking-wider">
            Lo que incluye
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
            Todo lo que necesita un equipo de ventas{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300">
              serio.
            </span>
          </h2>
          <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            Diseñado con distribuidores reales, no con focus groups. Cada
            funcionalidad nació de una hora atorada frente al portal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.n}
                className="group relative bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-8 hover:bg-white/[0.06] hover:border-cyan-300/30 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] transition-all duration-300"
              >
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0">
                    <div className="text-4xl font-mono font-black text-white/10 group-hover:text-cyan-300/40 transition-colors">
                      {f.n}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-400/20 border border-white/10 group-hover:from-blue-600/40 group-hover:to-cyan-400/40 transition-colors">
                      <Icon className="w-5 h-5 text-cyan-300" />
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      {f.title}
                    </h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* StatsBand                                                               */
/* ---------------------------------------------------------------------- */

function StatsBand() {
  return (
    <section className="relative py-24 overflow-hidden bg-[#060e20] border-y border-white/10">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(29, 78, 216, 0.25) 0%, transparent 45%),
            radial-gradient(circle at 80% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 45%)
          `,
        }}
      />
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-16">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-cyan-300 mb-14">
          Promedio en producción
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label} className="space-y-2">
              <div
                className={`text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight font-mono ${s.accent}`}
              >
                {s.value}
              </div>
              <div className="text-xs md:text-sm font-medium text-white/60 uppercase tracking-wider">
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12 text-xs text-white/40">
          $48M MXN = volumen de cotizaciones procesadas por la consola en los
          últimos 90 días.
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* PricingTeaser                                                           */
/* ---------------------------------------------------------------------- */

function PricingTeaser() {
  return (
    <section className="py-24 px-4 md:px-16 bg-[#0b1326]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-300/10 border border-cyan-300/20 text-cyan-300 text-[11px] font-semibold uppercase tracking-wider">
            Precios
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Empieza gratis. Crece sin permanencia.
          </h2>
          <p className="text-base text-white/60 max-w-xl mx-auto">
            Suscripción mensual en pesos. Sin tarjeta para los primeros días.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <PricingCard
            name="Starter"
            price="$0"
            period="primer mes"
            highlights={["1 distribuidor", "Cotizaciones ilimitadas", "PDF cliente"]}
          />
          <PricingCard
            featured
            name="Pro"
            price="$1,490"
            period="/mes"
            highlights={[
              "Hasta 5 vendedores",
              "PDF cliente + interno",
              "Calibrador de palancas",
              "Historial + CSV",
            ]}
          />
          <PricingCard
            name="Business"
            price="A medida"
            period=""
            highlights={["Multi-distribuidor", "SSO + auditoría", "SLA dedicado"]}
          />
        </div>

        <div className="text-center mt-10">
          <Link
            href="/precios"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
          >
            Ver detalle completo de precios
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  name,
  price,
  period,
  highlights,
  featured = false,
}: {
  name: string;
  price: string;
  period: string;
  highlights: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={
        featured
          ? "relative bg-gradient-to-br from-blue-600/20 to-cyan-400/10 backdrop-blur-md border border-cyan-300/40 rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.25)] scale-105"
          : "relative bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors"
      }
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
          Recomendado
        </div>
      )}
      <div className="text-sm font-semibold text-white/80 uppercase tracking-wider">
        {name}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold text-white font-mono tracking-tight">
          {price}
        </span>
        {period && (
          <span className="text-sm text-white/50">{period}</span>
        )}
      </div>
      <ul className="mt-6 space-y-2.5">
        {highlights.map((h) => (
          <li key={h} className="flex items-center gap-2 text-sm text-white/75">
            <CheckCircleIcon className="w-4 h-4 text-cyan-300 flex-shrink-0" />
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* FinalCTA — navy → cyan gradient                                         */
/* ---------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="relative py-32 px-4 md:px-16 overflow-hidden">
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
          Hablemos. Prueba gratis.{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 via-cyan-300 to-teal-300">
            Sin tarjeta.
          </span>
        </h2>
        <p className="text-lg text-white/70 max-w-2xl mx-auto">
          Activación en 24 horas. Validamos tu RFC, conectamos tus credenciales
          y cotizas el mismo día.
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

        {/* Trust micro-row */}
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
/* Footer                                                                  */
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
    </footer>
  );
}
