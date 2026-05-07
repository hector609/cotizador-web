import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-3xl w-full text-center">
        <div className="inline-block px-4 py-1 mb-6 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 rounded-full">
          Cotizador Telcel inteligente
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6">
          Cotiza Telcel
          <br />
          <span className="text-blue-700">en segundos</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Bot inteligente para distribuidores autorizados. Genera cotizaciones,
          aplica palancas de rentabilidad y descarga PDFs sin abrir el portal Telcel.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition shadow-md"
          >
            Iniciar sesión →
          </Link>
          <a
            href="https://t.me/CMdemobot"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-blue-700 bg-white border-2 border-blue-700 rounded-lg hover:bg-blue-50 transition"
          >
            ¿Prefieres Telegram?
          </a>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            {
              title: "🎯 Multi-distribuidor",
              desc: "Cada distribuidor con sus propias credenciales. Datos aislados, cero leak entre cuentas.",
            },
            {
              title: "⚡ Rápido",
              desc: "Cotizaciones en 2-4 minutos. Búsqueda de expedientes optimizada.",
            },
            {
              title: "📊 Calibrador A/B",
              desc: "Ajusta automáticamente el precio para llegar a la rentabilidad objetivo.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"
            >
              <h3 className="font-bold text-lg text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>

        <footer className="mt-20 text-sm text-slate-500">
          Powered by <span className="font-semibold">Hectoria</span> · No oficial Telcel
        </footer>
      </div>
    </main>
  );
}
