import Link from "next/link";
import {
  ArrowRightIcon,
  DocumentTextIcon,
  UsersIcon,
} from "@/components/icons";
import { DashboardNav } from "./_nav";

// Handle del bot en Telegram — se mantiene como puerta secundaria. La web
// es ahora el cotizador principal (chat conversacional en /dashboard/cotizar);
// quien prefiera el bot lo encuentra como fallback discreto.
const TELEGRAM_BOT_URL = "https://t.me/CotizadorInteligenteBot";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="inicio" showHomeTitle />

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">
            Listo. Tu cotizador está activo.
          </h2>
          <p className="text-slate-600">
            Genera cotizaciones desde el chat de aquí en menos de 5 minutos.
            Tus PDFs, cartera y métricas viven en este panel.
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white rounded-2xl shadow-lg p-10 md:p-14 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-6">
            {/* Chat bubble — la web es ahora el cotizador principal. */}
            <svg
              className="w-8 h-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            Cotiza desde aquí, sin abrir el portal Telcel.
          </h3>
          <div className="text-blue-100 text-lg max-w-xl mx-auto mb-8 space-y-4">
            <p>
              Cuéntale al asistente qué necesitas (RFC, líneas, equipo, plan)
              y te devuelve el PDF oficial en 3-5 minutos. Sin formularios
              multi-paso, sin abrir varias pestañas.
            </p>
            <p>
              Aquí mismo encuentras tu cartera de clientes, métricas de uso y
              el historial de PDFs generados por tu equipo.
            </p>
          </div>
          <Link
            href="/dashboard/cotizar"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition shadow-lg"
          >
            Abrir chat de cotización
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
          <p className="text-blue-200 text-xs mt-6">
            ¿Prefieres Telegram? El bot sigue activo —{" "}
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              abrir bot
            </a>
            . Soporte:{" "}
            <a
              href="https://instagram.com/hectoria.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              @hectoria.mx
            </a>
            .
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/clientes"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-400 hover:shadow-sm transition"
          >
            <UsersIcon className="w-6 h-6 text-blue-700 mb-2" />
            <h4 className="font-semibold text-slate-900 mb-1">Mis clientes</h4>
            <p className="text-sm text-slate-600">
              Tu cartera de clientes corporativos sincronizada con el portal del
              operador. Busca por RFC, razón social o expediente.
            </p>
          </Link>
          <Link
            href="/dashboard/cotizar"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-400 hover:shadow-sm transition"
          >
            <DocumentTextIcon className="w-6 h-6 text-blue-700 mb-2" />
            <h4 className="font-semibold text-slate-900 mb-1">Cotizar ahora</h4>
            <p className="text-sm text-slate-600">
              Abre el chat y arranca una cotización. El primer plan listo para
              enviar al cliente toma 2 minutos.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
