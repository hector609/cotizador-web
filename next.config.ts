import type { NextConfig } from "next";

// React dev-mode (Next.js dev / Turbopack HMR) usa eval() para reconstruir
// stack traces y soportar fast refresh. En producción NO lo usa. Sólo aflojamos
// la CSP en dev para que no rompa el console + hot reload.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrcExtra = isDev ? " 'unsafe-eval'" : "";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; " +
      `script-src 'self' 'unsafe-inline'${scriptSrcExtra} https://telegram.org; ` +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https://t.me https://*.telegram.org; " +
      "connect-src 'self' https://cmdemobot.fly.dev https://*.fly.dev; " +
      "frame-src https://oauth.telegram.org https://telegram.org; " +
      "frame-ancestors 'none';",
  },
];

// Headers específicos para /admin/* — proxy al bot Fly que carga Tailwind/
// ApexCharts/Geist desde CDNs. CSP relajado solo en esa ruta.
const adminProxyHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self' https://cmdemobot.fly.dev; " +
      `script-src 'self' 'unsafe-inline'${scriptSrcExtra} https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cmdemobot.fly.dev; ` +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cmdemobot.fly.dev; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: https://cmdemobot.fly.dev https://lh3.googleusercontent.com; " +
      "connect-src 'self' https://cmdemobot.fly.dev https://*.fly.dev; " +
      "frame-ancestors 'none';",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      // Admin proxy CSP — debe ir ANTES del catch-all para que Next aplique
      // el más específico primero.
      {
        source: "/admin/:path*",
        headers: adminProxyHeaders,
      },
      {
        source: "/admin",
        headers: adminProxyHeaders,
      },
      {
        // Catch-all SIN /admin (admin lleva CSP propio arriba). Sin esto,
        // Next.js mezcla headers de ambas reglas y el CSP estricto del
        // global gana, bloqueando Tailwind/ApexCharts/Geist en el proxy.
        source: "/((?!admin).*)",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      // Passthrough proxy a bot Fly. Las cookies del bot (Set-Cookie sin
      // Domain explícito) las guarda el navegador bajo cotizador.hectoria.mx,
      // así que el flujo de login se mantiene en este dominio.
      { source: "/admin", destination: "https://cmdemobot.fly.dev/admin/dashboard" },
      { source: "/admin/:path*", destination: "https://cmdemobot.fly.dev/admin/:path*" },
    ];
  },
};

export default nextConfig;
