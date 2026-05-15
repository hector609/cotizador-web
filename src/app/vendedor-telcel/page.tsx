/**
 * /vendedor-telcel — Landing page dedicated to Vendedor Telcel plan.
 * 
 * Prominent messaging: "$399/mes, 14 días gratis. Cotiza directamente en Telcel."
 * CTA: "Probar Vendedor Telcel 14 días" (links to /signup?plan=vendedor_telcel).
 */

import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Zap, Lock, Users, MessageSquare } from "lucide-react";
import { ConciergeWidget } from "@/components/concierge/ConciergeWidget";

export const metadata: Metadata = {
  title: "Vendedor Telcel | Cotizador SaaS",
  description:
    "Acceso directo al portal Telcel desde nuestro cotizador. $399/mes, 14 días gratis.",
};

export default function VendedorTelcelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600">
            Cotizador
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/precios" className="text-sm text-slate-600 hover:text-slate-900">
              Planes
            </Link>
            <Link href="/ayuda" className="text-sm text-slate-600 hover:text-slate-900">
              Ayuda
            </Link>
            <Link
              href="/login"
              className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
            >
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 sm:py-32 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
          Plan para vendedores individuales Telcel
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
          Vendedor Telcel
        </h1>
        
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Cotiza directamente en el portal Telcel sin abandonar nuestro cotizador. 
          Acceso completo, seguridad garantizada, 14 días gratis.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/signup?plan=vendedor_telcel"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold text-base hover:opacity-90 transition-opacity shadow-lg"
          >
            Probar Vendedor Telcel 14 días
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-sm text-slate-500">
            Sin tarjeta de crédito. Cancela cuando quieras.
          </p>
        </div>

        {/* Trial info badge */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-4 inline-block">
          <p className="text-sm text-indigo-900 font-medium">
            <strong>$399 MXN/mes</strong> después de 14 días gratis
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <h2 className="text-2xl font-bold text-slate-900 text-center">
          Todo lo que necesitas
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Zap className="w-6 h-6" />,
              title: "Cotizar en segundos",
              desc: "Acceso directo a catálogos Telcel sin salir del cotizador.",
            },
            {
              icon: <Lock className="w-6 h-6" />,
              title: "Historial seguro",
              desc: "Todas tus cotizaciones guardadas y organizadas en un solo lugar.",
            },
            {
              icon: <MessageSquare className="w-6 h-6" />,
              title: "Soporte en vivo",
              desc: "Chat con nuestro equipo. Concierge integrado en el dashboard.",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white px-6 py-8 space-y-3 hover:border-indigo-200 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-slate-900">{feature.title}</h3>
              <p className="text-sm text-slate-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing / CTA */}
      <section className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <div className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-cyan-50 px-8 py-12 text-center space-y-4">
          <h2 className="text-3xl font-bold text-slate-900">
            Precios simples, sin sorpresas
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">Primeros 14 días</p>
              <p className="text-4xl font-extrabold text-slate-900">Gratis</p>
            </div>
            <div className="text-2xl text-slate-400">→</div>
            <div>
              <p className="text-sm text-slate-600 mb-2">A partir del día 15</p>
              <p className="text-4xl font-extrabold text-indigo-600">
                $399
                <span className="text-lg text-slate-600"> MXN/mes</span>
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 pt-4">
            Cancela en cualquier momento. Sin contratos.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900 text-center">Incluye</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Acceso directo a Telcel",
              "Historial ilimitado",
              "Descarga PDF",
              "Chat Concierge",
              "Exportar a Excel",
              "Soporte por email",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-slate-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <h2 className="text-2xl font-bold text-slate-900 text-center">
          Comparar con otros planes
        </h2>
        <p className="text-center text-slate-600">
          <Link href="/precios" className="text-indigo-600 hover:underline font-medium">
            Ver todos los planes y características →
          </Link>
        </p>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-6 py-16 text-center space-y-6">
        <h2 className="text-3xl font-bold text-slate-900">
          Listo para empezar?
        </h2>
        <p className="text-lg text-slate-600">
          14 días gratis, sin tarjeta de crédito.
        </p>
        <Link
          href="/signup?plan=vendedor_telcel"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg"
        >
          Probar Vendedor Telcel 14 días
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* Concierge Widget */}
      <ConciergeWidget />
    </div>
  );
}
