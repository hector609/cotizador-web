# Cotizador Telcel — Web App

Aplicación web complementaria al bot Telegram CMdemobot. Permite cotizar Telcel desde un navegador con UI completa, multi-tenant, login para distribuidores.

## Stack

- **Next.js 15** con App Router
- **TypeScript** + **Tailwind CSS**
- **Vercel** para hosting (free tier)
- Backend: comparte el de [`hector609/cotizador-telcel`](https://github.com/hector609/cotizador-telcel) (Fly.io)

## Páginas

- `/` — landing pública con CTA a login
- `/login` — login con Telegram widget + email/password
- `/dashboard` — vista privada con KPIs, clientes, cotizar, historial
- `/api/auth/login` — endpoint stub para autenticar

## Setup local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Deploy

Push a `main` → Vercel deployea automático.

## Dominio

Producción: `cotizador.hectoria.mx` (Cloudflare DNS → Vercel)

## Pendientes

- [ ] Conectar `/api/auth/login` con backend Fly.io
- [ ] Telegram Login Widget configurado en BotFather
- [ ] Flow `/cotizar` que llama `/api/cotizar` (= comando `/cot` del bot)
- [ ] Listado de clientes (`/api/clientes`)
- [ ] Historial de cotizaciones
- [ ] Descarga PDFs
- [ ] Magic link via Resend (cuando dominio esté verificado)

## Arquitectura

```
Internet
   ↓
cotizador.hectoria.mx (Cloudflare DNS)
   ↓
Vercel (este repo) — frontend Next.js
   ↓ API calls
cmdemobot.fly.dev (cotizador-telcel) — backend Python + Playwright
```
