import type { Metadata } from "next";
import Home from "./_HomeClient";

export const metadata: Metadata = {
  title: "Cotizador Inteligente para Distribuidores | Hectoria",
  description:
    "Cotiza empresas en segundos desde Telegram o la web. PDFs oficiales, historial completo y optimizador de palancas para distribuidores autorizados en México.",
  openGraph: {
    title: "Cotizador Inteligente para Distribuidores — Hectoria",
    description:
      "Cotiza 10x más rápido desde Telegram o tu navegador. Para distribuidores autorizados en México. Sin tarjeta para empezar.",
    url: "https://cotizador.hectoria.mx",
    siteName: "Hectoria Cotizador",
    locale: "es_MX",
    type: "website",
  },
  alternates: {
    canonical: "https://cotizador.hectoria.mx",
  },
};

// TODO: refactor ayuda, login, signup 'use client' pages to Server wrappers with metadata
export default function Page() {
  return <Home />;
}
