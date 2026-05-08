import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-3xl w-full text-center">
        <div className="inline-block px-4 py-1 mb-6 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 rounded-full">
          Cotizador Inteligente para DATS
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6">
          Cotiza
          <br />
          <span className="text-blue-700">en segundos</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Bot inteligente para distribuidores autorizados de telefonía corporativa. Genera cotizaciones,
          aplica palancas de rentabilidad y descarga PDFs oficiales sin abrir el portal del operador líder en México.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition shadow-md"
          >
            Solicitar acceso →
          </Link>
          <Link
            href="/precios"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-blue-700 bg-white border-2 border-blue-700 rounded-lg hover:bg-blue-50 transition"
          >
            Ver planes y precios
          </Link>
          <a
            href="https://t.me/CMdemobot"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-slate-600 hover:text-slate-900 transition"
          >
            ¿Prefieres Telegram?
          </a>
        </div>

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-slate-600">
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

        <footer className="mt-20 text-sm text-slate-500 space-y-3">
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://instagram.com/hectoria.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-slate-900 transition"
              aria-label="Instagram de Hectoria"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              @hectoria.mx
            </a>
            <span className="text-slate-300">·</span>
            <a
              href="https://hectoria.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition"
            >
              hectoria.mx
            </a>
          </div>
          <div className="text-xs">
            Desarrollado por <span className="font-semibold">Hectoria</span> · No afiliado a operadores oficiales
          </div>
        </footer>
      </div>
    </main>
  );
}
