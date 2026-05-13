import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";
import { Toaster } from "@/components/toast/Toaster";
import { CommandPalette } from "@/components/command-palette/CommandPalette";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cotizador Inteligente — Telcel en minutos",
  description:
    "Cotizador Inteligente para DATS — distribuidores autorizados Telcel. Cotiza, compara y cierra en minutos. Desarrollado por Hectoria.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cotizador",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    title: "Cotizador Inteligente — Telcel en minutos",
    description:
      "Cotiza Telcel en minutos. Compara planes, equipos y plazos con un agente conversacional.",
    images: ["/brand/og.png"],
    type: "website",
    locale: "es_MX",
  },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <Toaster />
        <CommandPalette />
      </body>
    </html>
  );
}
