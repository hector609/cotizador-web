import Link from "next/link";
import type { Metadata } from "next";
import { Smartphone, Download, ShieldCheck, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Descargar Cotizador para Android · Hectoria",
  description: "Instala el Cotizador Telcel en tu Android en 3 minutos.",
};

export default function DescargarPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-cyan-50 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/30">
            <Smartphone className="h-8 w-8" />
          </span>
        </div>

        <h1 className="text-center text-4xl font-black tracking-tight text-slate-900">
          Cotizador para Android
        </h1>
        <p className="mt-3 text-center text-lg text-slate-600">
          Instálalo en tu celular en 3 minutos. Funciona offline parcialmente y siempre tienes la
          última versión del catálogo Telcel.
        </p>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <a
            href="/cotizador.apk"
            download
            className="group flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-500/40 transition-all hover:shadow-xl hover:shadow-indigo-500/50"
          >
            <Download className="h-6 w-6 group-hover:translate-y-0.5 transition-transform" />
            Descargar APK
          </a>

          <p className="mt-3 text-center text-xs text-slate-500">
            Última versión · ~5 MB · Android 7.0+
          </p>

          <div className="mt-8 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Cómo instalar
            </h2>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  1
                </span>
                <span>Toca <strong>&quot;Descargar APK&quot;</strong> arriba.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  2
                </span>
                <span>
                  Android te avisará que <em>&quot;este tipo de archivo puede dañar tu
                  dispositivo&quot;</em>. Toca <strong>Aceptar</strong> — es nuestra app.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  3
                </span>
                <span>
                  Abre el archivo descargado. Android pedirá permiso para instalar de esta fuente
                  → activa el toggle <strong>&quot;Permitir esta fuente&quot;</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  4
                </span>
                <span>
                  Toca <strong>Instalar</strong>. El icono <em>Cotizador</em> aparecerá en tu
                  home.
                </span>
              </li>
            </ol>
          </div>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">¿Por qué Android me advierte?</p>
                <p className="mt-1">
                  Porque la app no está en Play Store. Para nuestro piloto privado distribuimos
                  por <Link href="/" className="underline">hectoria.mx</Link> directo. La advertencia es estándar de Android, no significa
                  que la app sea peligrosa.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-sm text-emerald-800">
                <p className="font-semibold">Tu cuenta y datos están seguros</p>
                <p className="mt-1">
                  La app es la misma que ya usas en <Link href="/" className="underline">cotizador.hectoria.mx</Link>{" "}
                  pero corriendo como aplicación nativa Android. Tus credenciales y cotizaciones
                  viven en nuestros servidores cifrados, no en el celular.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center text-sm text-slate-500">
          <p>
            ¿Prefieres usar el navegador?{" "}
            <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
              Abre cotizador.hectoria.mx
            </Link>
          </p>
          <p className="mt-2">
            ¿Problemas instalando?{" "}
            <a
              href="mailto:soporte@hectoria.mx"
              className="font-semibold text-indigo-600 hover:underline"
            >
              soporte@hectoria.mx
            </a>
          </p>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-slate-500 hover:text-indigo-600">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
