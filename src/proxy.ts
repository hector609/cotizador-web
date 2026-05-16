/**
 * proxy.ts — Primera línea de defensa para rutas protegidas.
 *
 * ADVERTENCIA — Next.js 16 breaking change:
 *   El archivo `middleware.ts` fue deprecado y renombrado a `proxy.ts`.
 *   La función exportada se llama `proxy` (no `middleware`).
 *   Ver: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 *
 * SEGURIDAD — Qué hace este archivo y qué NO hace:
 *
 *   SÍ hace:
 *     - Verifica la PRESENCIA de la cookie `session` antes de dejar pasar
 *       a cualquier ruta bajo /dashboard/** y /onboarding/**.
 *     - Redirige a /login (con ?next=...) si la cookie no existe.
 *     - Evita que rutas nuevas queden públicas por olvido.
 *
 *   NO hace:
 *     - Validar el HMAC de la cookie. Proxy corre en Node.js runtime pero
 *       SESSION_SECRET puede no estar disponible en todos los entornos de
 *       edge/CDN deployment. La validación criptográfica real ocurre en
 *       `getSession()` / `getSessionOrNull()` dentro de cada RSC (Server
 *       Component) o Route Handler — esa es la segunda línea de defensa.
 *     - Autorizar acciones cross-tenant. Eso vive en los Route Handlers con
 *       `signBackendRequest()` y el HMAC de X-Auth hacia el bot.
 *
 * FLUJO:
 *   Browser → [proxy: cookie present?] → RSC → [getSession(): HMAC válido?] → UI
 *   Si el HMAC falló en getSession(), la page hace redirect('/login') desde el RSC.
 *   Middleware (proxy) solo elimina el acceso sin cookie — capa más externa.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*'],
};
