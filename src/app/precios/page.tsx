import Link from "next/link";

const planes = [
  {
    nombre: "Starter",
    precio: 499,
    cotizaciones: "100",
    vendedores: "1",
    destacado: false,
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
    precio: 1299,
    cotizaciones: "500",
    vendedores: "5",
    destacado: true,
    features: [
      "Todo lo de Starter +",
      "Hasta 5 vendedores",
      "500 cotizaciones/mes",
      "Calibrador A/B automático",
      "Dashboard con métricas",
      "Soporte prioritario",
    ],
  },
  {
    nombre: "Business",
    precio: 2999,
    cotizaciones: "Ilimitadas",
    vendedores: "Ilimitados",
    destacado: false,
    features: [
      "Todo lo de Pro +",
      "Vendedores ilimitados",
      "Cotizaciones ilimitadas",
      "Subdominio personalizado (próximamente)",
      "Branding propio (próximamente)",
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

export default function PreciosPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-blue-700">
            ← Hectoria
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Iniciar sesión →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-block px-4 py-1 mb-6 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 rounded-full">
          Planes y precios
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
          Cotiza más rápido,
          <br />
          <span className="text-blue-700">cierra más ventas.</span>
        </h1>
        <p className="text-lg text-slate-600 mb-2 max-w-2xl mx-auto">
          Para distribuidores autorizados de telefonía corporativa. Pago mensual, cancela cuando quieras.
        </p>
        <p className="text-sm text-slate-500">Precios en pesos mexicanos, sin IVA.</p>
      </section>

      {/* Planes */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        {/* Trust signals */}
        <div className="mb-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Datos en México
          </span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Cifrado en tránsito
          </span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Cancela cuando quieras
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planes.map((p) => (
            <div
              key={p.nombre}
              className={`relative bg-white rounded-2xl shadow-sm border-2 p-8 ${
                p.destacado
                  ? "border-blue-700 shadow-xl md:scale-105"
                  : "border-slate-200"
              }`}
            >
              {p.destacado && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-full">
                  Más popular
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-900 mb-1">{p.nombre}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-slate-900">
                  ${p.precio.toLocaleString("es-MX")}
                </span>
                <span className="text-slate-500 text-sm">MXN/mes</span>
              </div>
              <ul className="space-y-3 mb-8">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <svg
                      className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
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
                Empezar
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-slate-500 mt-10">
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
            <div className="inline-block px-4 py-1 mb-4 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 rounded-full">
              Roadmap 2026
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
            <div className="inline-block px-4 py-1 mb-4 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 rounded-full">
              Preguntas frecuentes
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              Lo que más nos preguntan
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "¿Cómo funciona el pago?",
                a: "Suscripción mensual, sin compromiso de permanencia. Cancela cuando quieras desde tu cuenta y conservas el acceso hasta el fin del periodo pagado.",
              },
              {
                q: "¿Qué pasa si excedo las cotizaciones del plan?",
                a: "Te enviamos una notificación al acercarte al límite y otra al alcanzarlo, con la opción de hacer upgrade al siguiente plan en un clic. Nunca te cortamos el servicio sin avisar.",
              },
              {
                q: "¿Mis datos están seguros?",
                a: "Sí. Servidores en México, cifrado en tránsito (HTTPS), aislamiento por tenant y tu RFC nunca se expone fuera de tu cuenta. No vendemos ni compartimos datos.",
              },
              {
                q: "¿Necesito instalar algo?",
                a: "No. Funciona directamente en Telegram (bot oficial) y en tu navegador. Sin APKs, sin extensiones, sin VPN.",
              },
            ].map((item) => (
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
            Iniciar sesión →
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
