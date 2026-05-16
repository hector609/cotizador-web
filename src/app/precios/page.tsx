import type { Metadata } from "next";
import PreciosPage from "./_PreciosClient";

export const metadata: Metadata = {
  title: "Precios — Cotizador Inteligente para Distribuidores | Hectoria",
  description:
    "Planes mensuales para distribuidores autorizados. Cotiza 10x más rápido, sin permanencia, cancela cuando quieras. Desde $399 MXN/mes con IVA incluido.",
  openGraph: {
    title: "Precios — Cotizador Inteligente para Distribuidores",
    description:
      "Planes mensuals para distribuidores autorizados. Sin permanencia, activación en 24 horas, sin tarjeta para empezar.",
    url: "https://cotizador.hectoria.mx/precios",
    siteName: "Hectoria Cotizador",
    locale: "es_MX",
    type: "website",
  },
  alternates: {
    canonical: "https://cotizador.hectoria.mx/precios",
  },
};

export default function Page() {
  return <PreciosPage />;
}
