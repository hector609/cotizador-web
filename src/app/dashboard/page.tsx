import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Cotizador Telc...</h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-blue-700 font-medium">
              Dashboard
            </Link>
            <Link href="/dashboard/clientes" className="text-slate-600 hover:text-slate-900">
              Clientes
            </Link>
            <Link href="/dashboard/cotizar" className="text-slate-600 hover:text-slate-900">
              Cotizar
            </Link>
            <Link href="/dashboard/historial" className="text-slate-600 hover:text-slate-900">
              Historial
            </Link>
            <Link href="/" className="text-slate-500 hover:text-slate-700 ml-4">
              Salir
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Bienvenido</h2>
          <p className="text-slate-600">Resumen de tu cuenta</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Cotizaciones hoy", value: "0", color: "blue" },
            { label: "Cotizaciones del mes", value: "0", color: "green" },
            { label: "Clientes activos", value: "0", color: "purple" },
            { label: "Rentabilidad promedio", value: "—", color: "orange" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white p-5 rounded-xl shadow-sm border border-slate-200"
            >
              <p className="text-sm text-slate-600 mb-1">{kpi.label}</p>
              <p className="text-3xl font-bold text-slate-900">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            🚧 Web app en construcción
          </h3>
          <p className="text-slate-600 mb-6">
            Mientras tanto, sigue usando el bot de Telegram que ya tienes.
          </p>
          <a
            href="https://t.me/CMdemobot"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center px-6 py-3 bg-[#229ED9] text-white font-semibold rounded-lg hover:bg-[#1a87bd] transition"
          >
            Abrir bot Telegram
          </a>
        </div>
      </div>
    </main>
  );
}
