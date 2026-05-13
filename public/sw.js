// Service Worker — Cotizador Hectoria PWA
// Estrategia: app-shell con cache estático + network-first para API.
// Versión: bump CACHE_NAME cuando se cambien assets estáticos para forzar refresh.

const CACHE_NAME = 'cotizador-hectoria-v2-2026-05-13-rediseno';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Agregar aquí CSS/JS críticos del app-shell cuando se conozcan los paths reales
  // Ej: '/_next/static/css/main.css' (Next.js) o '/assets/index.css' (Vite)
];

// Rutas que SIEMPRE deben ir a red (nunca cachear):
const NETWORK_ONLY_PATHS = [
  '/api/',
  '/cotizar/run',
  '/auth/',
  '/login',
  '/logout',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Precache parcial (algunos assets no existen aún):', err);
      });
    })
  );
  // Activar el SW nuevo inmediatamente (sin esperar a que cierren todas las tabs)
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Borrando cache vieja:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Tomar control de las pestañas abiertas
  self.clients.claim();
});

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar GET. POST/PUT/DELETE van directo a red.
  if (request.method !== 'GET') return;

  // No interceptar requests cross-origin (CDNs, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Network-only para rutas dinámicas (API, auth, cotizar)
  const isNetworkOnly = NETWORK_ONLY_PATHS.some((p) => url.pathname.startsWith(p));
  if (isNetworkOnly) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first para assets estáticos, con fallback a red
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Solo cachear respuestas OK y básicas (no opaque/error)
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          // Offline fallback: si pidieron una página HTML y no hay red, devolver el shell
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
        });
    })
  );
});

// ─── Mensajes desde la app (opcional) ──────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
