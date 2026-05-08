import Link from "next/link";

// Placeholder — el usuario ajustará el handle real del bot en Telegram.
const TELEGRAM_BOT_URL = "https://t.me/CotizadorInteligenteBot";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">
            Cotizador Inteligente para DATS
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-blue-700 font-medium">
              Dashboard
            </Link>
            <Link
              href="/dashboard/clientes"
              className="text-slate-600 hover:text-slate-900"
            >
              Clientes
            </Link>
            <Link
              href="/"
              className="text-slate-500 hover:text-slate-700 ml-4"
            >
              Salir
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Bienvenido</h2>
          <p className="text-slate-600">Tu cotizador vive donde tú trabajas.</p>
        </div>

        <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white rounded-2xl shadow-lg p-10 md:p-14 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-6">
            <svg
              className="w-8 h-8"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
            </svg>
          </div>
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            Tu cotización vive en Telegram
          </h3>
          <p className="text-blue-100 text-lg max-w-xl mx-auto mb-8">
            Cotiza, busca expedientes y descarga PDFs oficiales desde el chat
            que ya usas a diario. Sin instalar nada, sin cambiar de pestaña.
          </p>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition shadow-lg"
          >
            Abrir bot
            <span aria-hidden="true">→</span>
          </a>
          <p className="text-blue-200 text-xs mt-6">
            ¿Aún no estás dado de alta? Pide tu acceso a tu administrador.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/clientes"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-400 hover:shadow-sm transition"
          >
            <h4 className="font-semibold text-slate-900 mb-1">Mis clientes</h4>
            <p className="text-sm text-slate-600">
              Consulta tu cartera de RFCs sincronizada desde el portal del
              operador autorizado.
            </p>
          </Link>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-400 hover:shadow-sm transition"
          >
            <h4 className="font-semibold text-slate-900 mb-1">Cotizar ahora</h4>
            <p className="text-sm text-slate-600">
              Abre el bot en Telegram y empieza una cotización en menos de un
              minuto.
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}
