# HANDOFF — Cotizador Inteligente para DATS

> **Para Claude CLI / cualquier agente que retome este trabajo.**
> Este documento explica qué se hizo, por qué se hizo así, dónde quedó el estado, y qué falta para llegar a producción funcional. Léelo completo antes de tocar código.

---

## 0. TL;DR — POR QUÉ TELEGRAM LOGIN ESTÁ FALLANDO AHORA MISMO

El fix de seguridad **F1** del pentest cambió `/api/auth/telegram` para que ya NO emita cookie a cualquier usuario de Telegram. Ahora valida contra el backend del bot. El login fallará con `503` o `403` hasta que se cumplan **TRES** condiciones simultáneas:

1. **Bot redeployed en Fly** con el código de `main` (commit `17b613c` en adelante). El nuevo bot expone `POST /api/v1/auth/verify` y `GET/POST /api/v1/cotizaciones`.
2. **`SESSION_SECRET` seteado en Vercel y Fly** — *exactamente el mismo valor en ambos*. Sin esto, las cookies de la web se firman con un secreto que el bot no puede verificar (HMAC fail). Comando:
   ```bash
   SS=$(openssl rand -hex 32)
   vercel env add SESSION_SECRET production <<< "$SS"
   fly secrets set SESSION_SECRET="$SS" -a cmdemobot   # nombre exacto de la app
   ```
3. **El `telegram_id` del usuario está en la tabla `vendedores`** con un `distribuidor_id` válido. Si no, el bot devuelve `403` y la web traduce a `403`. Para agregar tu user:
   ```bash
   ssh fly  # o `fly ssh console -a cmdemobot`
   ADMIN_OVERRIDE=1 python scripts/agregar_vendedor.py <telegram_id> "<Nombre>" --distribuidor 1
   ```

Si ya hiciste los 3 pasos y sigue fallando, lee §6 (Troubleshooting).

---

## 1. ALCANCE — QUÉ SE HIZO EN ESTA SESIÓN

Trabajo coordinado de **9 agentes especializados** (UX, copywriter, diseñador, código, seguridad, pentest, RLS, multi-tenant, fix crítico) sobre dos repos:

- `hector609/cotizador-web` — Next.js 15 (App Router) en Vercel.
- `hector609/cotizador-telcel-bot` — python-telegram-bot v21 + FastAPI + SQLite + (futuro) Playwright en Fly.io.

Ambos PRs ya están **merged a `master`/`main`** vía squash:
- Web: PR #2 merge SHA `8182a71` (+commit previo `931b0e5` que removió el roadmap interno expuesto).
- Bot: PR #1 merge SHA `17b613c`.

### 1.1 Cambios por categoría

**REBRAND (urgente, ya hecho)**
- Producto: "Cotizador Inteligente para DATS". Antes literal `"Cotizador Telc..."` (truncado por error de copy).
- Desarrollador: "Hectoria" en footers. Hectoria NO es el nombre del producto, sólo el dev.
- Eliminado el nombre "Telcel" en texto user-facing. Donde aplica se reemplaza por "el operador líder en México" o frases neutras. Comentarios y código interno conservan referencias técnicas (no es problema legal — simple discreción comercial).
- Eliminado "Sistema sin fines de lucro" del footer (contradecía los planes pagados de $499/$1299/$2999 MXN).

**EXPOSICIÓN DE PLAN (motivo original del trabajo)**
- La página `/precios` exponía la "Fase 4 — Visión" con métricas internas: "Margen ~85%", "$80K MXN/mes", "3,000-5,000 distribuidores en MX". Eliminado y reemplazado por roadmap orientado al cliente.

**LÓGICA DE VENTAS**
- Trust signals (Datos en MX · Cifrado · Cancela cuando quieras) en landing y precios.
- FAQ con 8 preguntas en `/precios` (antes 4).
- `/dashboard` ya no muestra KPIs falsos en cero — ahora hero card "Tu cotización vive en Telegram" con CTA al bot.
- CTA "Solicitar acceso" abre `mailto:hola@hectoria.mx` o IG `@hectoria.mx` (copy honesto: el flow es asistido, no self-service).
- Plan Business: features no construidas (subdominios, branding, Stripe/CFDI) marcadas `(próximamente)`.

**DISEÑO**
- Librería de 12 iconos SVG inline en `src/components/icons/index.tsx` (Heroicons outline, sin dependencia externa).
- Componentes `Section`, `Badge`, `TrustSignals` en `src/components/ui/`.
- Style guide en `design/style-guide.md`, mapping en `design/component-mapping.md`, top 10 mejoras en `design/improvements.md`.
- Eliminado `md:scale-105` que rompía la comparación de planes.
- `globals.css`: usar `var(--font-geist-sans)` (antes Arial). Eliminado `prefers-color-scheme: dark` (no había componentes que lo soportaran).

**COPY**
- Drafts en `/copy/*.md` (landing, precios, faq, login, dashboard) — aplicados a los `.tsx`.

**PÁGINAS NUEVAS**
- `/dashboard/cotizar` — formulario web multi-paso (Client Component, Suspense, useSearchParams).
- `/dashboard/historial` — tabla server-rendered con filtros por estado/fecha y paginación.
- `src/app/dashboard/_nav.tsx` — tabs reutilizables (no se han integrado al `dashboard/page.tsx`; pendiente).
- `/api/cotizaciones` — proxy autenticado al bot.

**SEGURIDAD CRÍTICA (basada en pentest CVSS 9.8 + 9.1)**
| ID | Issue | Fix |
|---|---|---|
| F1 | `/api/auth/telegram` aceptaba cualquier login y emitía cookie con `tenant_id = telegram_id` (no había whitelist) | Llama a `${BOT_API_URL}/api/v1/auth/verify`; payload de cookie ahora contiene `{ vendedor_id, distribuidor_id, role, iat, exp }`. Fail-closed: 503 si backend cae, 403 si telegram_id no autorizado. |
| F2 | HMAC desync — web usaba `HMAC(BOT_TOKEN, tenant_id)` sin timestamp, bot esperaba `v1.<ts>.<hmac>` con `SESSION_SECRET` | Helper `signBackendRequest()` en `src/lib/backend-auth.ts` produce `X-Auth: v1.<tenant_id>.<ts>.<hmac(SESSION_SECRET, "v1\|<id>\|<ts>")>`. Eliminado `tenant_id` de query strings. |
| F3 | Cookie sin `exp` server-side | `verifySessionCookie` rechaza si `exp <= now`. |
| F7 | `SESSION_SECRET` leído en module-load → crash en `npm run build` sin env var | Lazy `getSessionSecret()`. |
| F8 | `String(e)` reflejado al cliente leakea stacktraces | Errores genéricos al cliente, log estructurado server-side. |
| F9 | Doble click en confirm → 2 cotizaciones | Idempotency-Key header + dedup 5min en memoria (TODO Vercel KV). |
| Headers | Ningún CSP/XFO/HSTS | `next.config.ts` con HSTS 1y, CSP, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, `poweredByHeader: false`. |

**MULTI-TENANT (bot)**
- Migración 001: tabla `distribuidores` + FKs en `vendedores/cotizaciones/clientes`.
- Migración 002: `eventos.distribuidor_id`.
- Migración 003: `lock_portal` per-tenant + `idempotency_key` en cotizaciones.
- `tenant_scope` context manager (`src/db/tenant_session.py`) — obligatorio en las 5 funciones de `models.py`. Antes ignoraban `distribuidor_id` y todo se atribuía al tenant 1.
- Lock per-tenant: cotizar de tenant A ya no bloquea cotizaciones de tenant B.
- `LOCK_TTL_SECONDS` 180s → 120s (era > Playwright timeout = lock zombie).
- Credenciales del portal cifradas con Fernet (`PORTAL_ENCRYPTION_KEY`).

**API HTTP del bot**
- `POST /api/v1/auth/verify` — verifica HMAC del Login Widget de Telegram + lookup en whitelist.
- `GET /api/v1/cotizaciones` — filtro por `distribuidor_id` derivado del HMAC.
- `POST /api/v1/cotizaciones` — soporta `Idempotency-Key`, respeta `DRY_RUN`.
- Schema X-Auth: `v1.<tenant_id>.<ts>.<hmac(SESSION_SECRET, ...)>`. Documentado en `docs/CONTRACT.md`.
- Stub `_list_clientes_for_tenant` aún por cablear (cotizaciones es lo crítico para el web).

**INFRA bot**
- Dockerfile: `mcr.microsoft.com/playwright/python:v1.48.0-jammy` + usuario non-root `botuser`.
- fly.toml: 1024 MB (antes 256 MB → Chromium OOM seguro).

**TESTS**
- Bot: 41 tests pasando (RFC validators, redact_rfc, models con tenant scope, lock per-tenant, endpoints API).
- Web: tests aún sin runner (vitest no configurado). Hay drafts ejecutables manualmente en `src/lib/__tests__/backend-auth.test.ts` con `tsx`.

**DOCUMENTOS NUEVOS**
- `cotizador-web/copy/*.md` — drafts copywriter.
- `cotizador-web/design/*.md` — style guide + mapping + improvements.
- `cotizador-web/docs/PENTEST-REPORT.md` — 11 hallazgos con PoCs.
- `cotizador-telcel-bot/docs/CONTRACT.md` — contrato HTTP web↔bot.
- `cotizador-telcel-bot/docs/MIGRATIONS.md` — runner + secciones 001/002/003 + wiring tenant_scope.
- `cotizador-telcel-bot/docs/RLS-POLICIES.md` — Postgres RLS policies para cuando se migre.
- `cotizador-telcel-bot/docs/MULTI-TENANT-ISOLATION.md` — auditoría de aislamiento (gaps + recomendaciones).

---

## 2. DECISIONES + RACIONALES

| Decisión | Por qué |
|---|---|
| Cookie de sesión firmada con `SESSION_SECRET` dedicado, no `TELEGRAM_BOT_TOKEN` | Reuse de keys es la falla #1 del pentest (CVSS 9.8). El bot token también firma el widget HMAC y X-Auth backend; si se filtra (y se filtra fácil en deploy), el atacante minteaba sesiones. |
| Tenant ID embebido en el HMAC, no en query string | Si el tenant viaja por query, el cliente puede manipularlo. Embebido en HMAC + verificado server-side con `SESSION_SECRET` = imposible de falsificar sin el secreto. |
| Fail-closed en backend caído (503) en lugar de fail-open | Mejor login roto que dashboard accesible sin auth. Match estándar OWASP. |
| `tenant_scope` como context manager (no parámetro explícito) | Olvidarlo es trivial; con context manager raise si no está activo, *imposible* olvidar el filtro. Equivalente al `app.current_distribuidor_id` de Postgres RLS. |
| SQLite por ahora, Postgres "antes del segundo tenant" | RLS real requiere Postgres. Mientras solo hay 1 tenant, `tenant_scope` aplicado consistentemente da equivalencia funcional. RLS-POLICIES.md tiene las policies listas. |
| Lock per-tenant SIN tocar el algoritmo de DB | Migración aditiva (`ALTER ADD COLUMN`), wrapper deprecado para compat. Cero downtime. |
| Eliminar `md:scale-105` del plan destacado | Visualmente atractivo, pero rompe la comparación lado-a-lado que es el momento crítico de decisión de compra B2B. |
| FAQ con `<details>/<summary>` nativos | Cero JS extra, accesible, SEO-friendly. |
| Copy "Sin tarjeta para empezar la prueba" | Fricción #1 de B2B SaaS signup. Posiciona honestamente que el flow es asistido. |

---

## 3. DÓNDE QUEDÉ — ESTADO ACTUAL

### 3.1 Listo y mergeado en `master`/`main`
- Todo lo descrito en §1.
- Build pasa: `SESSION_SECRET=test npm run build` ✅, `pytest -q` 41/41 ✅.
- Type-check pasa: `npx tsc --noEmit` ✅.

### 3.2 Pendiente humano — DEPLOY
1. **Setear secrets** en Vercel y Fly (mismo valor de `SESSION_SECRET`):
   ```bash
   SS=$(openssl rand -hex 32)
   PEK=$(openssl rand -base64 32)
   vercel env add SESSION_SECRET production <<< "$SS"
   vercel env add BOT_API_URL production <<< "https://cmdemobot.fly.dev"
   fly secrets set SESSION_SECRET="$SS" PORTAL_ENCRYPTION_KEY="$PEK" -a cmdemobot
   ```
2. **Deploy** ambos:
   ```bash
   # web: vercel deploy --prod
   # bot:
   fly deploy -a cmdemobot
   ```
3. **Aplicar migraciones** en producción (idempotente; verifica `PRAGMA user_version`):
   ```bash
   fly ssh console -a cmdemobot -C "python scripts/migrate.py"
   ```
4. **Cifrar la password actual del portal** y persistirla:
   ```python
   from src.portal.credentials import encrypt_password_for_storage
   import sqlite3
   enc = encrypt_password_for_storage("<password real>")
   conn = sqlite3.connect("/app/data/db.sqlite")
   conn.execute("UPDATE distribuidores SET portal_user=?, portal_password_encrypted=? WHERE id=1", ("<user>", enc))
   conn.commit()
   ```
5. **Agregar tu telegram_id como vendedor del distribuidor 1**:
   ```bash
   fly ssh console -a cmdemobot -C "ADMIN_OVERRIDE=1 python scripts/agregar_vendedor.py <TU_TELEGRAM_ID> 'Hector' --distribuidor 1"
   ```
6. **Reemplazar placeholder** `https://t.me/CotizadorInteligenteBot` en `src/app/dashboard/page.tsx` con el handle real (ej. `https://t.me/cmdemobot`).

### 3.3 Pendiente futuro — NO bloquea launch pero hay que hacerlo
1. **Stub `_list_clientes_for_tenant` en bot** — `/api/v1/clientes` retorna lista vacía. La página `/dashboard/clientes` del web depende de esto. Implementar query a `clientes` con `WHERE distribuidor_id = ?`.
2. **Worker Playwright** — `POST /api/v1/cotizaciones` hoy retorna `pendiente`. Falta el worker que tome `portal_lock(distribuidor_id)`, ejecute Playwright contra el portal del operador, suba el PDF y haga `actualizar_cotizacion(id, estado='completada', pdf_url=...)`. La fase Playwright fue pospuesta (Phase 3 del roadmap interno).
3. **Idempotency-Key store en Vercel** — hoy es in-memory en cada Lambda; en prod-distribuido no dedup entre instancias. Cambiar a Vercel KV o Redis.
4. **Migrar a Postgres** antes del segundo tenant (ver `docs/RLS-POLICIES.md` del bot).
5. **Sentry / structured logs** — el código ya emite `console.error` y logs Python; falta enchufarlo a un destino.
6. **Tests web (vitest)** — agregar runner. Tests críticos: HMAC verify, cookie expiry, F1 whitelist check.
7. **Selector de distribuidor en `auth/verify`** — si un mismo `telegram_id` pertenece a varios distribuidores, hoy elige el de menor id. UX para que el usuario seleccione.
8. **Volume de Fly** — está en `cotizador_data` (nombre legacy); el agente C dejó nota porque renombrar a `data` requiere migración manual del volumen.
9. **Tabs `_nav.tsx`** — el componente existe pero `dashboard/page.tsx` aún no lo importa.
10. **Dashboard/clientes refactor** — listado actual está fuera de scope del trabajo (ver `design/component-mapping.md` "out of scope").
11. **Catálogo de equipos hardcoded** en `/dashboard/cotizar` — TODO conectar a `/api/v1/equipos` cuando exista.

---

## 4. RIESGOS / VIABILIDAD

### 4.1 Riesgos altos
- **Si `SESSION_SECRET` se filtra**: catastrófico — atacante mintea sesiones cross-tenant. Mitigación: rotar inmediatamente; las sesiones existentes invalidarán automáticamente porque el HMAC ya no verifica.
- **Si la migración 001 falla a medias en prod**: la columna `distribuidor_id` puede quedar `NULL` con `DEFAULT 1`. Verificar con `SELECT COUNT(*) FROM cotizaciones WHERE distribuidor_id IS NULL` post-migración. Si > 0, backfill manualmente.
- **Si el bot reusa el `TELEGRAM_BOT_TOKEN` viejo en producción** (que pudo haber sido compartido en deploys/canales): cualquier persona con acceso al token puede mintear logins-widget válidos. Recomendado: rotar en @BotFather después del deploy. La sesión NO depende del bot token (gracias al fix F1+F7), pero el `auth/verify` sí lo usa para validar el widget HMAC — rotación es transparente.
- **Stub backends**: `/api/v1/clientes` retorna `[]`. La UI `/dashboard/clientes` se ve "vacía" pero no rota. El usuario no podrá ver clientes hasta que se implemente. Comunicar al cliente o esconder la tab.

### 4.2 Riesgos medios
- **Tests web ausentes**: F1, F2, F3 son seguridad pura — un refactor accidental puede romperlos sin detectar. Prioridad #1 después del launch.
- **Idempotency en memoria**: si un cliente hace doble click justo cuando Vercel hace cold-start o cambia de instancia, ambos requests pasan. Probabilidad baja (5min de cache es razonable), pero existente.
- **DRY_RUN flag**: si se queda activo en producción accidentalmente, las cotizaciones quedan como completadas con datos simulados. El guard de `ADMIN_TELEGRAM_ID` no aplica a `DRY_RUN`. Agregar guard simétrico es 5 líneas.

### 4.3 Lo que NO se hizo (consciente)
- **No se rotó ningún secreto** — el agente no tiene acceso a Vercel/Fly/BotFather. El humano tiene que hacerlo.
- **No se ejecutaron migraciones en prod** — el agente solo modificó el código del runner y los SQL.
- **No se desplegó nada** — solo se mergeó a master/main.
- **No se tocaron `docs/PROMPT-MAESTRO.md` ni `docs/GUIA-CODEGEN.md`** — son del owner para Phase 3 Playwright.
- **No se modificó la lógica de Playwright** (`src/portal/`) — Phase 3 explícitamente pospuesta.

---

## 5. CÓMO EVALUAR SI EL TRABAJO ES VIABLE

Si Claude CLI lee esto, sugerencia de checklist de evaluación:

1. **Lee primero**: este archivo + `docs/PENTEST-REPORT.md` (web) + `docs/MULTI-TENANT-ISOLATION.md` (bot) + `docs/CONTRACT.md` (bot).
2. **Verifica los fixes**:
   - `git log master --oneline -25` (web) → debe verse: rebrand, sales-logic, security, F1/F2 fixes, copy/design, cotizar/historial.
   - `git log main --oneline -25` (bot) → multi-tenant, redact, rate-limit, API server.
3. **Corre los tests**: `cd cotizador-telcel-bot && pytest -q` debe dar 41/41 ✅.
4. **Verifica que el build pase**: `cd cotizador-web && SESSION_SECRET=test npm run build`.
5. **Chequeos manuales sugeridos**:
   - `src/app/api/auth/telegram/route.ts` — ¿llama al backend? ¿maneja 503? ¿NO emite cookie sin verify?
   - `src/lib/backend-auth.ts` — ¿el HMAC es `v1.<tenant>.<ts>.<hmac>`? ¿lee `SESSION_SECRET` lazy?
   - `src/db/models.py` (bot) — ¿todas las funciones derivan tenant del context? ¿raise si no hay scope?
   - `src/api/server.py` (bot) — `/auth/verify` ¿valida HMAC del widget? `/cotizaciones` ¿filtra por tenant? ¿el tenant viene del HMAC, no del query?
   - `src/db/lock.py` (bot) — ¿`acquire_lock` recibe `distribuidor_id`? ¿el wrapper viejo lanza warning?
6. **Pentest follow-up**: del reporte (11 hallazgos), F1/F2/F3/F5/F7/F8/F9 marcados como completos. F4 (replay del widget en 1h, criticidad media) y F6 (RFC sin redact en `cotizaciones`) **NO se atacaron** — recomendación: F6 es trivial (extender redact a la columna `payload` de `cotizaciones`), F4 requiere store de nonces.
7. **Decide**: ¿deploy ahora con los pendientes documentados, o haces F6 + worker Playwright primero?

---

## 6. TROUBLESHOOTING login

Si después de deploy + secrets + migración + agregar vendedor sigue fallando:

| Síntoma | Causa probable | Fix |
|---|---|---|
| `503` al hacer login | Bot no responde / `BOT_API_URL` malo | `curl https://cmdemobot.fly.dev/health` |
| `403 no_authorized` | `telegram_id` no está en `vendedores` | `ADMIN_OVERRIDE=1 python scripts/agregar_vendedor.py ...` |
| Login OK pero `/api/clientes` 401 | `SESSION_SECRET` mismatch web↔bot | `vercel env ls` + `fly secrets list -a cmdemobot`, confirmar mismo valor |
| Login OK pero dashboard en blanco | `/api/v1/clientes` stub | Esperado hoy — pendiente cablear (§3.3 #1) |
| `Build failed: SESSION_SECRET required` | Vercel sin env var | `vercel env add SESSION_SECRET` |
| `pytest` falla en `test_models_tenant` | Migración no aplicada local | `python scripts/migrate.py` |
| Cotización en `/dashboard/cotizar` da 502 | Backend `/cotizaciones` POST no implementado del todo (worker faltante) | DRY_RUN=true para probar UI; worker pendiente §3.3 #2 |

---

## 7. ARCHIVOS CLAVE — TOUR RÁPIDO

```
cotizador-web/
├── src/app/api/auth/telegram/route.ts   # F1 fix vive aquí
├── src/lib/auth.ts                       # cookie session (F3 + F7)
├── src/lib/backend-auth.ts               # F2 HMAC helper
├── src/app/api/clientes/route.ts         # proxy autenticado
├── src/app/api/cotizaciones/route.ts     # proxy + idempotency (F8 + F9)
├── src/app/dashboard/cotizar/page.tsx    # form web multi-paso (NUEVO)
├── src/app/dashboard/historial/page.tsx  # tabla cotizaciones (NUEVO)
├── src/components/icons/index.tsx        # 12 SVG inline
├── src/components/ui/{Section,Badge,TrustSignals}.tsx
├── next.config.ts                        # security headers
├── docs/PENTEST-REPORT.md                # ← LECTURA OBLIGADA
└── HANDOFF.md                            # este archivo

cotizador-telcel-bot/
├── src/db/migrations/001_add_tenants.sql
├── src/db/migrations/002_eventos_distribuidor.sql
├── src/db/migrations/003_lock_per_tenant.sql
├── src/db/tenant_session.py              # context manager
├── src/db/models.py                      # las 5 funciones, todas con tenant_scope
├── src/db/lock.py                        # per-tenant
├── src/api/server.py                     # /auth/verify + /cotizaciones
├── src/portal/credentials.py             # Fernet por tenant
├── src/utils/redact.py                   # redact_rfc
├── docs/CONTRACT.md                      # ← LECTURA OBLIGADA
├── docs/MIGRATIONS.md
├── docs/RLS-POLICIES.md
├── docs/MULTI-TENANT-ISOLATION.md
└── HANDOFF.md                            # gemelo de este archivo
```

---

## 8. CONTACTO ORIGINAL

Owner: hector609 (Hectoria · @hectoria.mx).
Trabajo realizado el 2026-05-08 por Claude (modelo Opus 4.7) en Claude Code Web, sesión coordinada con 9 agentes.

PR del trabajo:
- https://github.com/hector609/cotizador-web/pull/2
- https://github.com/hector609/cotizador-telcel-bot/pull/1
- https://github.com/hector609/cotizador-web/pull/1 (anterior, exposición Fase 4)
