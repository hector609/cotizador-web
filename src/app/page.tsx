import Link from "next/link";
import {
  ArrowRightIcon,
  BoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  LockClosedIcon,
  MapPinIcon,
  SparklesIcon,
  UsersIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { TrustSignals } from "@/components/ui/TrustSignals";

/* ---------------------------------------------------------------------- */
/* Data                                                                    */
/* ---------------------------------------------------------------------- */

const pasos = [
  {
    n: "01",
    title: "Cuéntale al asistente",
    desc: "Escribe en español natural: cuántas líneas, qué plan, plazo y equipo. Sin formularios ni dropdowns.",
  },
  {
    n: "02",
    title: "El bot abre el portal por ti",
    desc: "Aplica las palancas, busca el expediente y arma la cotización mientras tomas otra llamada.",
  },
  {
    n: "03",
    title: "Recibes ambos PDFs",
    desc: "PDF oficial para el cliente y PDF interno con tu margen real, listos para enviar o archivar.",
  },
];

const features = [
  {
    icon: SparklesIcon,
    title: "Cotiza por chat",
    desc: "Conversación en lenguaje natural con el asistente. Lo mismo que escribirías a tu vendedor estrella.",
  },
  {
    icon: ChartBarIcon,
    title: "Optimiza palancas",
    desc: "El calibrador propone las palancas que cumplen tu rentabilidad objetivo sin sacrificar el cierre.",
  },
  {
    icon: DocumentTextIcon,
    title: "PDF cliente + interno",
    desc: "Doble salida en cada cotización: la que se envía firmada y la que se guarda para reportar margen.",
  },
  {
    icon: UsersIcon,
    title: "Historial completo",
    desc: "Cada cotización queda registrada por vendedor, RFC y fecha. Filtros para auditar en segundos.",
  },
];

// Orden recomendado: arranque (cómo cobramos, qué incluye), después seguridad.
const faqs = [
  {
    q: "¿Tengo que abrir el portal del operador?",
    a: "No. El cotizador entra al portal por ti con tus credenciales de DAT, aplica las palancas y descarga los PDFs oficiales. Tú trabajas desde el chat o desde Telegram; el portal queda fuera de tu día.",
  },
  {
    q: "¿Cómo funciona el pago?",
    a: "Suscripción mensual en pesos sin permanencia. Los primeros días son sin tarjeta: validamos tu RFC de distribuidor, te damos accesos y empiezas a cotizar. El cobro arranca cuando confirmas el plan. Facturación CFDI disponible en Pro y Business.",
  },
  {
    q: "¿Mis datos y los de mis clientes están seguros?",
    a: "Servidores en México, cifrado en tránsito (HTTPS/TLS) en todo el flujo y aislamiento por tenant. Cada distribuidor solo ve sus propias credenciales y cartera; los RFC nunca se exponen en logs públicos ni se comparten con terceros.",
  },
  {
    q: "¿Funciona si tengo varios vendedores?",
    a: "Sí. Cada vendedor entra con su propio acceso y cotiza en paralelo sin pisarse con los demás. Como dueño ves todo el equipo desde un dashboard consolidado, con filtro por vendedor y por cliente.",
  },
  {
    q: "¿Qué pasa si el operador cambia el portal o los planes?",
    a: "Lo absorbemos nosotros. Cuando el operador mueve algo (precios, palancas, layout), actualizamos el bot del lado del servidor. La mayoría de cambios se aplican en horas; tú no haces nada.",
  },
  {
    q: "¿Puedo probarlo antes de pagar?",
    a: "Sí. Pedimos tu RFC, agendamos una llamada corta para configurar credenciales y haces cotizaciones reales de tu operación durante la prueba. Si no te ayuda, no facturamos.",
  },
];

/* ---------------------------------------------------------------------- */
/* Page                                                                    */
/* ---------------------------------------------------------------------- */

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Top nav — quiet, just wordmark + auth links */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-slate-900"
          >
            Hectoria <span className="text-blue-700">Cotizador</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/precios"
              className="hidden sm:inline-block text-sm font-medium text-slate-600 hover:text-slate-900 transition"
            >
              Precios
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 transition px-4 py-2 rounded-lg shadow-md"
            >
              Probar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ---------- HERO ---------- */}
      <section className="bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left — copy + CTAs */}
            <div className="lg:col-span-6">
              <div className="mb-6">
                <Badge variant="primary">Cotizador inteligente para DATS</Badge>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6">
                Una cotización corporativa{" "}
                <span className="text-blue-700">en lo que tarda un café.</span>
              </h1>
              <p className="text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
                Cotizador para distribuidores autorizados: PDFs oficiales, palancas
                de rentabilidad y multi-vendedor — sin abrir el portal del operador
                ni una vez.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition shadow-md"
                >
                  Probar gratis
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </Link>
                <Link
                  href="/precios"
                  className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-blue-700 bg-white border-2 border-blue-700 rounded-lg hover:bg-blue-50 transition"
                >
                  Ver precios
                </Link>
              </div>
              <TrustSignals
                align="start"
                items={[
                  { icon: MapPinIcon, label: "Datos en México" },
                  { icon: LockClosedIcon, label: "Cifrado en tránsito" },
                  { icon: CheckCircleIcon, label: "Cancela cuando quieras" },
                ]}
              />
            </div>

            {/* Right — Real product slice: chat mockup with floating PDF card */}
            <div className="lg:col-span-6 relative">
              <ChatMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CÓMO FUNCIONA ---------- */}
      <Section bg="white" spacing="md">
        <div className="text-center mb-12">
          <div className="mb-4">
            <Badge variant="primary">Cómo funciona</Badge>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            De la conversación al PDF firmado, en 3 pasos.
          </h2>
          <p className="text-slate-600 mt-3 max-w-2xl mx-auto">
            Sin formularios largos, sin dropdowns infinitos, sin tocar el portal.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pasos.map((p) => (
            <div
              key={p.n}
              className="bg-white rounded-xl border border-slate-200 p-6"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-3">
                Paso {p.n}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {p.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- LOGOS PILOTOS ---------- */}
      <Section bg="slate" spacing="sm">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-6">
            Distribuidores piloto que ya cotizan con Hectoria
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {/* TODO: replace with real SVG logos when CeluMaster/Huvasi provide brand assets */}
            <PilotLogoPlaceholder name="CeluMaster" />
            <PilotLogoPlaceholder name="Huvasi" />
            <PilotLogoPlaceholder name="Tu distribución aquí" muted />
          </div>
        </div>
      </Section>

      {/* ---------- FEATURES ---------- */}
      <Section bg="white" spacing="md">
        <div className="text-center mb-12">
          <div className="mb-4">
            <Badge variant="primary">Lo que incluye</Badge>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Todo lo que necesita un equipo de ventas serio.
          </h2>
          <p className="text-slate-600 mt-3 max-w-2xl mx-auto">
            Diseñado con distribuidores reales, no con focus groups. Cada
            funcionalidad nació de una hora atorada frente al portal.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm"
              >
                <Icon className="w-6 h-6 text-blue-700 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ---------- DIFERENCIADOR / MICRO-PROOF ---------- */}
      <Section bg="slate" spacing="md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <Stat number="2 min" label="Cotización completa" sub="vs. 20+ min haciéndolo a mano" />
          <Stat number="100%" label="PDFs oficiales" sub="Mismo formato que entrega el portal" />
          <Stat number="24h" label="Activación" sub="Validamos RFC y empiezas el mismo día" />
        </div>
      </Section>

      {/* ---------- FAQ ---------- */}
      <Section bg="white" spacing="md" width="narrow">
        <div className="text-center mb-10">
          <div className="mb-4">
            <Badge variant="primary">Preguntas frecuentes</Badge>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Lo que más nos preguntan
          </h2>
        </div>
        <div className="space-y-4">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group bg-white rounded-xl border border-slate-200 p-5 open:shadow-sm"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-slate-900">
                <span>{item.q}</span>
                <span
                  className="text-blue-700 text-xl ml-4 transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="text-slate-600 text-sm mt-3 leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Section>

      {/* ---------- CTA STRIP ---------- */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Recupera la mañana entera, todos los días.
          </h2>
          <p className="text-blue-100 mb-8 text-lg max-w-2xl mx-auto leading-relaxed">
            Activación en 24 horas. Sin tarjeta para empezar — primero el bot
            funciona en tu operación, después hablamos de cobro.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition shadow-lg"
            >
              Probar gratis
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Link>
            <a
              href="https://t.me/CMdemobot"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white border-2 border-white/40 rounded-lg hover:bg-white/10 transition"
            >
              <DevicePhoneMobileIcon className="w-5 h-5" />
              Probar en Telegram
            </a>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="bg-slate-50 border-t border-slate-200 text-sm text-slate-600">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="font-bold text-slate-900">
              Hectoria <span className="text-blue-700">Cotizador</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Software para distribuidores autorizados · No afiliado a operadores
              oficiales
            </p>
          </div>
          <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
            <Link href="/precios" className="hover:text-slate-900 transition">
              Precios
            </Link>
            <Link href="/login" className="hover:text-slate-900 transition">
              Iniciar sesión
            </Link>
            <a
              href="https://instagram.com/hectoria.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition"
            >
              @hectoria.mx
            </a>
            <a
              href="https://hectoria.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition"
            >
              hectoria.mx
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* Sub-components                                                          */
/* ---------------------------------------------------------------------- */

/**
 * ChatMockup — slice REAL del producto: panel del chat conversacional con un
 * mensaje del vendedor, la respuesta del asistente, una card de cotización
 * lista y una badge flotante con el folio.
 *
 * No abstractions: replica el look del `<ChatInterface>` del dashboard
 * (bubbles, avatar "AI" en gradient, card de cotización completada).
 */
function ChatMockup() {
  return (
    <div className="relative">
      {/* Floating folio badge — top-left */}
      <div className="hidden md:flex absolute -top-4 -left-4 z-20 items-center gap-2 bg-white border border-slate-200 rounded-full pl-2 pr-4 py-2 shadow-md">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-600 text-white">
          <CheckCircleIcon className="w-4 h-4" />
        </span>
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold leading-none">
            Folio
          </div>
          <div className="text-sm font-mono font-semibold text-slate-900 leading-tight">
            2378845
          </div>
        </div>
      </div>

      {/* Main chat card */}
      <div className="relative z-10 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Mock header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-blue-700 to-blue-900 text-white text-xs font-bold">
              AI
            </span>
            <div className="text-sm font-semibold text-slate-900 leading-tight">
              Nueva cotización
            </div>
          </div>
          <Badge variant="muted" size="sm" uppercase={false}>
            En vivo
          </Badge>
        </div>

        {/* Chat body */}
        <div className="p-5 space-y-4 bg-slate-50">
          {/* User bubble */}
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-blue-700 text-white rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-relaxed">
              Necesito 5 iPhone 17 Pro Max, plan empresa VPN, 24 meses, para
              RFC OAX140324HE7.
            </div>
          </div>

          {/* Assistant bubble */}
          <div className="flex justify-start gap-2">
            <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-blue-700 to-blue-900 text-white text-[10px] font-bold mt-1">
              AI
            </span>
            <div className="max-w-[85%] bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-slate-700 leading-relaxed">
              Listo. Cotizo 5 líneas con iPhone 17 Pro Max, Plan Empresa VPN
              5GB, 24 meses, para{" "}
              <span className="font-mono font-semibold text-slate-900">
                OAX140324HE7
              </span>
              . El calibrador propone aplicar palanca <strong>A/B 92%</strong>{" "}
              para cumplir tu rentabilidad objetivo.
            </div>
          </div>

          {/* Cotización lista card */}
          <div className="ml-9 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100">
                <DocumentTextIcon className="w-5 h-5 text-blue-700" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900 leading-tight">
                  Cotización lista
                </div>
                <div className="text-xs text-slate-500">
                  5 líneas · 24 meses · A/B 92%
                </div>
              </div>
              <Badge variant="primary" size="sm">
                Completada
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Total mensual
                </div>
                <div className="text-base font-bold text-slate-900 font-mono">
                  $80,067.50
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Margen
                </div>
                <div className="text-base font-bold text-green-600 font-mono">
                  18.4%
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <span className="flex-1 text-center text-xs font-semibold text-white bg-blue-700 px-3 py-2 rounded-lg">
                PDF cliente
              </span>
              <span className="flex-1 text-center text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-2 rounded-lg">
                PDF interno
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating palancas card — bottom-right */}
      <div className="hidden md:block absolute -bottom-6 -right-4 z-20 bg-white border border-slate-200 rounded-xl shadow-md p-4 w-56">
        <div className="flex items-center gap-2 mb-2">
          <BoltIcon className="w-5 h-5 text-blue-700" />
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Palancas
          </div>
        </div>
        <ul className="space-y-1.5 text-xs text-slate-700">
          <li className="flex items-center justify-between">
            <span>Descuento equipo</span>
            <span className="font-mono font-semibold text-slate-900">35%</span>
          </li>
          <li className="flex items-center justify-between">
            <span>A/B mensual</span>
            <span className="font-mono font-semibold text-slate-900">92%</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Plazo</span>
            <span className="font-mono font-semibold text-slate-900">
              24 m
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * PilotLogoPlaceholder — text wordmark + faint border, used until CeluMaster
 * and Huvasi entreguen SVGs reales. Lecturable como "logos de marca" sin
 * pretender ser logos reales.
 */
function PilotLogoPlaceholder({
  name,
  muted = false,
}: {
  name: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 bg-white ${
        muted ? "text-slate-400" : "text-slate-700"
      }`}
    >
      <span className="text-base font-bold tracking-tight">{name}</span>
    </div>
  );
}

/**
 * Stat — número grande + label + sub, formato típico de stats strip B2B.
 */
function Stat({
  number,
  label,
  sub,
}: {
  number: string;
  label: string;
  sub: string;
}) {
  return (
    <div>
      <div className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 font-mono">
        {number}
      </div>
      <div className="text-sm font-semibold text-slate-900 mt-2">{label}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}
