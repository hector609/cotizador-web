import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  LockClosedIcon,
  MapPinIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { TrustSignals } from "@/components/ui/TrustSignals";

const planes = [
  {
    nombre: "Starter",
    tagline: "Para el que vende solo y quiere recuperar la mañana.",
    precio: 499,
    cotizaciones: "100",
    vendedores: "1",
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
    cotizaciones: "500",
    vendedores: "5",
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
    cotizaciones: "Ilimitadas",
    vendedores: "Ilimitados",
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-lg font-bold text-blue-700"
          >
            <ArrowRightIcon className="w-4 h-4 rotate-180 mr-2" />
            Hectoria
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Iniciar sesión
            <ArrowRightIcon className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="mb-6">
          <Badge variant="primary">Planes y precios</Badge>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
          Recupera 15 horas al mes
          <br />
          <span className="text-blue-700">desde $499.</span>
        </h1>
        <p className="text-lg text-slate-600 mb-2 max-w-2xl mx-auto leading-relaxed">
          Planes mensuales para distribuidores autorizados. Sin permanencia,
          cancela cuando quieras. Precios en MXN, sin IVA.
        </p>
      </section>

      {/* Planes */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        {/* Trust signals */}
        <TrustSignals
          className="mb-10"
          items={[
            { icon: MapPinIcon, label: "Datos en México" },
            { icon: LockClosedIcon, label: "Cifrado en tránsito" },
            { icon: CheckCircleIcon, label: "Cancela cuando quieras" },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planes.map((p) => (
            <div
              key={p.nombre}
              className={`relative bg-white rounded-2xl shadow-sm border-2 p-8 ${
                p.destacado
                  ? "border-blue-700 shadow-xl"
                  : "border-slate-200"
              }`}
            >
              {p.destacado && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="primary" size="md">
                    Recomendado
                  </Badge>
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-900 mb-1">{p.nombre}</h3>
              <p className="text-sm text-slate-600 mb-4">{p.tagline}</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-slate-900">
                  ${p.precio.toLocaleString("es-MX")}
                </span>
                <span className="text-slate-500 text-sm">MXN/mes</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Facturación CFDI disponible en planes Pro y Business.
              </p>
              <ul className="space-y-3 mb-8">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`block w-full text-center px-4 py-3 font-semibold rounded-lg transition ${
                  p.destacado
                    ? "bg-blue-700 text-white hover:bg-blue-800"
                    : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-base text-slate-700 mt-10 max-w-2xl mx-auto">
          Activación en 24 horas. Sin tarjeta para empezar la prueba — primero el
          bot funciona en tu operación, después hablamos de cobro.
        </p>
        <p className="text-center text-sm text-slate-500 mt-4">
          ¿Volumen mayor o necesidades custom?{" "}
          <a
            href="https://instagram.com/hectoria.mx"
            target="_blank"
            rel="noopener"
            className="text-blue-700 font-semibold hover:underline"
          >
            Contáctanos
          </a>
        </p>
      </section>

      {/* Roadmap */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <div className="mb-4">
              <Badge variant="primary">Roadmap 2026</Badge>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              Hacia dónde vamos
            </h2>
            <p className="text-slate-600 mt-3 max-w-2xl mx-auto">
              Construimos en público. Esto es lo que viene en los próximos meses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fases.map((f, idx) => (
              <div
                key={f.titulo}
                className="bg-slate-50 rounded-xl p-6 border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{f.titulo}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">
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
                      <span className="text-blue-700 font-bold mt-0.5">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-20">
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
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ¿Listo para empezar?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Únete a los distribuidores que ya cotizan con Hectoria.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition shadow-lg"
          >
            Iniciar sesión
            <ArrowRightIcon className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400 text-sm">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            Desarrollado por{" "}
            <span className="font-semibold text-white">Hectoria</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://instagram.com/hectoria.mx" target="_blank" rel="noopener" className="hover:text-white">
              @hectoria.mx
            </a>
            <a href="https://hectoria.mx" target="_blank" rel="noopener" className="hover:text-white">
              hectoria.mx
            </a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-6 text-xs text-slate-500">
          No afiliado a operadores oficiales · Software para distribuidores autorizados
        </div>
      </footer>
    </main>
  );
}
