# Onboarding Autónomo — Diseño Completo

> Estado: BORRADOR DE DISEÑO. No implementar hasta aprobación de Hector.
> Fecha: 2026-05-14

---

## A. User Journey — 10 Stages

### Stage 0: Landing + Precios

**Trigger:** Visitante llega a `cotizador.hectoria.mx` o `/precios`.

**Página/Componente:** `/precios/page.tsx` (ya existe), CTA "Empezar gratis 14 días".

**Estado backend:** Ninguno (anon).

**Email:** Ningún email.

**Edge cases:**
- Visitante ya tiene cuenta → detectar cookie y redirigir a `/dashboard`.
- Mobile: asegurar CTA visible above the fold.

---

### Stage 1: Formulario de Registro

**Trigger:** Click en CTA "Empezar gratis" o navegar a `/signup`.

**Página/Componente:** `/signup/page.tsx` (ya existe).

**Estado backend:** `POST /api/v1/signup` → crea registro en `signup_requests.jsonl` con estado `pendiente`. Envía mensaje Telegram al super-admin con botones Aprobar/Rechazar.

**Email enviado:** `send_signup_received()` — "Recibimos tu solicitud, respondemos en 24h hábiles."

**Cambio clave para onboarding autónomo:** El modelo actual requiere aprobación manual de Hector. Para onboarding self-serve real, necesitamos un modo "auto-aprobación" configurado por flag de entorno `AUTO_APPROVE_SIGNUPS=true` que salta la revisión manual y crea el tenant inmediatamente con trial de 14 días. Hector sigue recibiendo el Telegram como notificación, pero sin botones de decisión bloqueante.

**Edge cases:**
- RFC ya registrado → error 409 "RFC ya tiene cuenta, inicia sesión o contacta soporte".
- Email ya existe → redirigir a `/login`.
- Fallo de red al crear tenant → rollback registro y mostrar "Intenta en 5 minutos".

---

### Stage 2: Aprobación / Creación de Tenant

**Trigger:** Auto-aprobación inmediata (si `AUTO_APPROVE_SIGNUPS=true`) o Hector hace click en Telegram.

**Página/Componente:** Invisible para el usuario (proceso background).

**Estado backend:**
- `add_tenant(tenant_id, nombre, usuario="", password="", autorizados={})`.
- Subscription: `trialing`, `trial_ends_at = now + 14 días`.
- `onboarding.current_step = 1` (inicializado).
- `onboarding.completed_at = null`.
- `web_passwords.json` entry creada con password temporal autogenerado.

**Email enviado:** `send_signup_approved()` con password temporal, link al dashboard, y texto "Tu prueba de 14 días comienza ahora."

**Edge cases:**
- Fallo al crear tenant → reintento automático 3x con backoff, luego notificación admin.
- Fallo al enviar email → continuar flujo; el usuario igual puede entrar si ya tiene el link.

---

### Stage 3: Primer Login al Dashboard

**Trigger:** Usuario hace click en "Acceder al panel" del email.

**Página/Componente:** `/login/page.tsx` → redirect a `/dashboard`.

**Estado backend:** Crear sesión. Detectar que `onboarding.completed_at == null` y `onboarding.current_step < 7`.

**Acción frontend:** En `DashboardLayout`, si el usuario no ha completado onboarding, montar `<WizardModal step={currentStep} />` como overlay encima del dashboard.

**Edge cases:**
- Usuario entra directamente a `/dashboard` sin pasar por el wizard → el modal se monta igual, con opción "Saltar wizard" que marca `onboarding.skipped_at` pero no bloquea el dashboard.
- Password expirado → redirigir a página de cambio de password antes del wizard.

---

### Stage 4: Wizard — Pasos 1 a 7

**Trigger:** WizardModal montado al entrar al dashboard por primera vez.

**Página/Componente:** `<WizardModal />` overlay sobre el dashboard. Ver Sección B para mockups.

**Estado backend:** `POST /api/onboarding/step` después de cada paso completado.

**Email:** Ninguno (los emails del trial son por tiempo, ver Sección F).

**Edge cases:**
- Usuario cierra el browser a mitad del wizard → al volver, el wizard abre en el paso donde quedó.
- Usuario salta un paso → registrado en `onboarding.skipped` array; puede completarlo después desde Configuración.

---

### Stage 5: Carga de Credenciales Telcel (Wizard Paso 3)

**Trigger:** Paso 3 del wizard "Conecta tu cuenta Telcel".

**Página/Componente:** `WizardStep/TelcelCreds.tsx` → llama a `POST /api/tenant/credentials` (endpoint ya existe).

**Estado backend:** Credenciales cifradas con master key en `tenant_config.json`. Luego auto-trigger del scrape de cartera.

**Acción post-guardado:** `cartera_scraper.enqueue_job(tenant_id)` automáticamente → muestra spinner en Paso 4.

**Edge cases:**
- Credenciales inválidas (Telcel rechaza login) → error inline "Usuario o password incorrecto en el portal Telcel. Verifica y vuelve a intentar."
- Usuario no tiene credenciales Telcel todavía → botón "Saltar por ahora, lo hago después". El scrape no corre.
- Timeout del scrape (>5 min) → mostrar "La importación está tomando más tiempo, continúa y recibirás una notificación."

---

### Stage 6: Primera Cotización Guiada (Wizard Paso 5)

**Trigger:** Paso 5 del wizard "Haz tu primera cotización".

**Página/Componente:** `WizardStep/PrimerCotizacion.tsx` → llama a `/dashboard/cotizar` con datos de cliente de muestra prellenados.

**Estado backend:** Cotización real contra el portal Telcel (si las creds existen) o cotización sintética (si no).

**Edge cases:**
- Sin credenciales Telcel → mostrar cotización sintética con datos demo.
- Cotización falla → "No se pudo generar la cotización. Puedes intentarlo de nuevo después desde el menú Cotizar."

---

### Stage 7: Wizard Completado

**Trigger:** Usuario llega al Paso 7 "Invita a tu equipo" y hace click en "Finalizar".

**Página/Componente:** Pantalla de celebración dentro del modal → confetti animation → "¡Listo! Ya eres parte del Cotizador."

**Estado backend:** `POST /api/onboarding/complete` → `onboarding.completed_at = now()`.

**Email enviado:** Email Day-0 "Bienvenido, empezamos." (ver Sección F).

**Edge cases:**
- Fallo al marcar completed → continuar, reintentar en background.

---

### Stage 8: Dashboard Post-Onboarding con Trial Banner

**Trigger:** Wizard completado o saltado. Usuario usa el dashboard con normalidad.

**Página/Componente:** `<TrialBanner />` pegado arriba del sidebar o del header. Visible hasta que se convierte a plan de pago.

**Estado backend:** `subscription_status = "trialing"`.

**Email:** Secuencia automática Day-3, Day-7, Day-12 (ver Sección F).

**Edge cases:**
- Tenant sube a plan pago → ocultar TrialBanner permanentemente.
- Trial vence → `expire_stale_tenants()` job diario marca como `expired`. Modal `<UpgradePrompt />` bloquea el dashboard.

---

### Stage 9: Conversión a Plan Pago o Expiración

**Trigger:** Trial vence (14 días) o usuario hace click en "Activar plan".

**Página/Componente:**
- Conversión voluntaria: `/dashboard/billing/page.tsx` (ya existe).
- Expiración: `<UpgradePrompt />` overlay bloqueante.

**Estado backend:** Stripe Checkout → webhook actualiza `subscription_status = "active"`.

**Email enviado:** Day-15 "Tu prueba expiró. Activa tu plan para seguir cotizando."

**Edge cases:**
- Stripe webhook falla → job de reconciliación cada hora.
- Usuario en México con tarjeta extranjera → Stripe ya maneja esto.

---

### Stage 10: Retención / Re-engagement

**Trigger:** Usuario no ha cotizado en 7+ días.

**Página/Componente:** Ninguno nuevo (es email + notificación Telegram opcional).

**Email:** Email de re-engagement "¿Todo bien? Tienes X días de trial restantes."

**Edge cases:** No enviar si el usuario cotizó recientemente (leer historial antes de enviar).

---

## B. Wizard de 7 Pasos — Mockups ASCII

El wizard es un modal fullscreen en mobile y un panel central 560px en desktop. Siempre con fondo backdrop-blur sobre el dashboard.

### Paso 1 — Bienvenida

```
┌─────────────────────────────────────────────────────────────┐
│  ✦ Cotizador Inteligente para DATs                          │
│  ●○○○○○○  Paso 1 de 7                                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Ilustración: rocket lanzando / check mark grande    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ¡Hola, {{nombre_distribuidor}}!                            │
│                                                             │
│  Tu cuenta está lista. En los próximos 5 minutos            │
│  configuramos todo para que puedas cotizar solo,            │
│  sin llamadas, sin Excel manual.                            │
│                                                             │
│  Tu prueba gratuita: 14 días · Sin tarjeta requerida        │
│                                                             │
│                                           [Empezar →]       │
└─────────────────────────────────────────────────────────────┘
```

- Inputs: ninguno
- Validación: ninguna
- CTA primario: "Empezar →"
- Saltar: no aplica en paso 1

---

### Paso 2 — Información de la Empresa

```
┌─────────────────────────────────────────────────────────────┐
│  ✦ Cotizador Inteligente para DATs                          │
│  ●●○○○○○  Paso 2 de 7                                       │
│                                                             │
│  🏢 Cuéntanos sobre tu distribuidora                        │
│                                                             │
│  Estos datos aparecerán en tus PDFs de cotización.          │
│                                                             │
│  Nombre comercial                                           │
│  [Distribuidores Huvasi SA de CV           ]                │
│  ↳ Pre-llenado del signup, editable                         │
│                                                             │
│  Nombre del responsable de ventas                           │
│  [Jesús Martínez                           ]                │
│                                                             │
│  Ciudad / Estado                                            │
│  [CDMX                                     ]                │
│                                                             │
│  Logo de la empresa (opcional)                              │
│  [ Subir imagen .PNG .JPG (max 2 MB) ]                      │
│                                                             │
│  [Saltar]                          [Continuar →]            │
└─────────────────────────────────────────────────────────────┘

Validación inline:
- Nombre vacío → texto rojo bajo el campo: "Requerido"
- Archivo > 2MB → "Archivo demasiado grande, máx 2 MB"
- Formato inválido → "Solo PNG o JPG"

Loading state al subir logo:
- [Spinner]  Subiendo logo... (barra de progreso)

Error fallback:
- "No se pudo guardar. Intenta de nuevo" + botón reintentar
```

---

### Paso 3 — Credenciales Telcel

```
┌─────────────────────────────────────────────────────────────┐
│  ✦ Cotizador Inteligente para DATs                          │
│  ●●●○○○○  Paso 3 de 7                                       │
│                                                             │
│  🔐 Conecta tu cuenta del portal Telcel                     │
│                                                             │
│  Con esto podemos cotizar a tu nombre directamente          │
│  desde el portal oficial de Telcel Empresas.                │
│                                                             │
│  Usuario (email del portal Telcel)                          │
│  [distribuidor@empresa.com         ]                        │
│                                                             │
│  Password                                                   │
│  [••••••••••••••••••             👁 ]                       │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 🔒 Tus credenciales se cifran con AES-256 antes   │    │
│  │    de guardarse. No las vemos ni las compartimos.  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  [Saltar — lo hago después]        [Verificar y continuar →]│
└─────────────────────────────────────────────────────────────┘

Loading state (al hacer click en Verificar):
┌─────────────────────────────────────────────────────────────┐
│  [⟳ Verificando credenciales con Telcel...]                 │
│  Esto puede tardar 20-30 segundos                           │
└─────────────────────────────────────────────────────────────┘

Error — credenciales inválidas:
┌─────────────────────────────────────────────────────────────┐
│  ⚠ Usuario o contraseña incorrectos en el portal Telcel.   │
│    Verifica y vuelve a intentar. [Reintentar]               │
└─────────────────────────────────────────────────────────────┘

Error — fallo de red / timeout:
┌─────────────────────────────────────────────────────────────┐
│  ⚠ No pudimos conectar con el portal Telcel en este         │
│    momento. Guarda las credenciales y continúa —            │
│    verificaremos la conexión en segundo plano.              │
│                              [Continuar de todas formas →]  │
└─────────────────────────────────────────────────────────────┘
```

---

### Paso 4 — Importar Cartera de Clientes

```
┌─────────────────────────────────────────────────────────────┐
│  ✦ Cotizador Inteligente para DATs                          │
│  ●●●●○○○  Paso 4 de 7                                       │
│                                                             │
│  📋 Importando tu cartera de clientes                       │
│                                                             │
│  Estamos leyendo tu cartera directamente del portal         │
│  Telcel. Tarda 1-3 minutos.                                 │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [████████████░░░░░░░░░░]  42%                     │    │
│  │  Leyendo página 3 de 7...                          │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Mientras esperamos, aquí tienes un tip:                    │
│  💡 Puedes cotizar para cualquier RFC de tu cartera         │
│     con un solo comando.                                    │
│                                                             │
│              [Continuar sin importar — lo hago después]     │
└─────────────────────────────────────────────────────────────┘

Estado — importación completada:
┌─────────────────────────────────────────────────────────────┐
│  ✅ ¡Cartera importada!                                     │
│     47 clientes encontrados.                                │
│                                           [Continuar →]     │
└─────────────────────────────────────────────────────────────┘

Estado — sin credenciales (paso 3 saltado):
┌─────────────────────────────────────────────────────────────┐
│  ⏭ Saltaste la conexión con Telcel.                         │
│    Podrás importar tu cartera después desde Configuración.  │
│                                           [Continuar →]     │
└─────────────────────────────────────────────────────────────┘

Error — scrape falla:
┌─────────────────────────────────────────────────────────────┐
│  ⚠ No pudimos importar la cartera en este momento.          │
│    No te preocupes — puedes cotizar ingresando el RFC        │
│    manualmente. [Continuar igual →]                         │
└─────────────────────────────────────────────────────────────┘
```

---

### Paso 5 — Primera Cotización Guiada

```
┌─────────────────────────────────────────────────────────────┐
│  ✦ Cotizador Inteligente para DATs                          │
│  ●●●●●○○  Paso 5 de 7                                       │
│                                                             │
│  🧾 Haz tu primera cotización                               │
│                                                             │
│  Escribe el RFC de un cliente para cotizar, o usa           │
│  el cliente de ejemplo que preparamos:                      │
│                                                             │
│  RFC del cliente                                            │
│  [LUFJ831214AHA                    ] ← pre-llenado demo     │
│                                                             │
│  Líneas a cotizar                                           │
│  [5                                ]                        │
│                                                             │
│  Plan sugerido                                              │
│  ( ) Plan Business Basic   $299/línea                       │
│  (●) Plan Business Plus    $399/línea  ← recomendado        │
│  ( ) Plan Business Pro     $549/línea                       │
│                                                             │
│  [Saltar — cotizo después]     [Cotizar este cliente →]     │
└─────────────────────────────────────────────────────────────┘

Loading state:
┌─────────────────────────────────────────────────────────────┐
│  [⟳ Generando cotización en el portal Telcel...]            │
│  Tomará entre 2 y 5 minutos                                 │
│  Mientras esperas, puedes explorar el dashboard ↗           │
└─────────────────────────────────────────────────────────────┘

Resultado exitoso:
┌─────────────────────────────────────────────────────────────┐
│  ✅ ¡Cotización generada!                                   │
│     Folio #2378845  ·  $80,067.50 MXN  ·  5 líneas          │
│     [Ver PDF →]            [Continuar →]                    │
└─────────────────────────────────────────────────────────────┘
```

---

### Paso 6 — Leer el Veredicto / Entender el PDF

```
┌─────────────────────────────────────────────────────────────┐
│  ✦ Cotizador Inteligente para DATs                          │
│  ●●●●●●○  Paso 6 de 7                                       │
│                                                             │
│  📄 Entiende tu cotización en 30 segundos                   │
│                                                             │
│  El Cotizador genera 2 PDFs:                                │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  📋 PDF CLIENTE       📊 PDF INTERNO                 │  │
│  │  Lo que ve tu        Lo que ves tú:                  │  │
│  │  cliente: plan,      precio neto,                    │  │
│  │  precio, beneficios  margen A/B,                     │  │
│  │                      rentabilidad                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  El "A/B" es el descuento que aplica Telcel a tu            │
│  distribuidora. Puedes optimizarlo desde "Palancas".        │
│                                                             │
│  💡 Tip: Aria (el asistente IA) puede explicarte            │
│          cualquier número del veredicto. Prueba:            │
│          "¿Qué significa el A/B del 25%?"                   │
│                                                             │
│                                           [Entendido →]     │
└─────────────────────────────────────────────────────────────┘

(sin inputs, sin validación — es informativo)
```

---

### Paso 7 — Invitar al Equipo

```
┌─────────────────────────────────────────────────────────────┐
│  ✦ Cotizador Inteligente para DATs                          │
│  ●●●●●●●  Paso 7 de 7                                       │
│                                                             │
│  👥 ¿Tienes vendedores en tu equipo?                        │
│                                                             │
│  Invítalos para que también puedan cotizar                  │
│  sin necesitar tus credenciales.                            │
│                                                             │
│  Email del vendedor (opcional)                              │
│  [vendedor@empresa.com             ]  [+ Agregar]           │
│                                                             │
│  Invitados:                                                 │
│  • vendedor1@empresa.com    [× quitar]                      │
│                                                             │
│  O comparte tu link de invitación:                          │
│  https://cotizador.hectoria.mx/invite/{{token}}             │
│  [📋 Copiar link]                                           │
│                                                             │
│  [Saltar por ahora]             [Finalizar configuración ✓] │
└─────────────────────────────────────────────────────────────┘

Pantalla de éxito al hacer click en Finalizar:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              🎉                                             │
│                                                             │
│  ¡Todo listo, {{nombre}}!                                   │
│                                                             │
│  Tu cotizador está configurado.                             │
│  Tienes {{trial_days_remaining}} días de prueba gratuita.   │
│                                                             │
│                     [Ir al dashboard →]                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## C. Backend — Cambios Necesarios

### C.1 Nuevos endpoints

#### `POST /api/v1/onboarding/step`
```
Auth: X-Auth HMAC (tenant)
Body: {
  "step": 1-7,
  "skipped": false,
  "data": { ... campos relevantes del paso }
}
Response 200: { "ok": true, "next_step": 2 }
Response 400: { "error": "step inválido" }
```

#### `POST /api/v1/onboarding/complete`
```
Auth: X-Auth HMAC (tenant)
Body: {}
Response 200: { "ok": true, "completed_at": "ISO string" }
```

#### `GET /api/v1/onboarding/status`
```
Auth: X-Auth HMAC (tenant)
Response 200: {
  "current_step": 3,
  "completed_at": null,
  "skipped": [2]
}
```

#### `POST /api/v1/onboarding/invite`
```
Auth: X-Auth HMAC (tenant)
Body: { "emails": ["v@empresa.com"] }
Response 200: { "invited": 1, "invite_link": "https://..." }
```

#### `POST /api/v1/signup` — Cambio necesario
Agregar parámetro de entorno `AUTO_APPROVE_SIGNUPS`. Si `true`, crear tenant en el mismo handler sin esperar callback de Telegram. Seguir enviando notificación al admin pero no bloqueante.

### C.2 Cambios al schema de tenant_config

```jsonc
{
  // campos existentes...

  // NUEVO: bloque onboarding
  "onboarding": {
    "current_step": 1,          // int 1-7, null si no iniciado
    "completed_at": null,        // ISO o null
    "skipped": [],               // array de ints (pasos saltados)
    "company_display_name": "",  // nombre mostrado en PDFs (paso 2)
    "contact_name": "",          // nombre del responsable (paso 2)
    "city": "",                  // ciudad (paso 2)
    "logo_url": null,            // URL del logo en storage (paso 2)
    "first_quote_id": null       // ID de la primera cotización (paso 5)
  }
}
```

### C.3 Cambios a nivel usuario

En `web_passwords.json` agregar campo `onboarding_started_at` (ISO) para poder trackear cohortes de signup → onboarding → conversión.

### C.4 Webhooks / Jobs automáticos

- **Al completar paso 3 (creds Telcel):** Llamar automáticamente a `cartera_scraper.enqueue_job(tenant_id)`. El frontend pollea `GET /api/v1/cartera/status` cada 5s para mostrar el spinner del paso 4.
- **Al completar wizard (paso 7):** Encolar job de email Day-0 (ver Sección F).
- **Validación de credenciales:** Antes de avanzar del paso 3, intentar un login rápido en el portal Telcel (timeout 30s) y devolver éxito/fallo al frontend.

---

## D. Frontend — Componentes Nuevos

### Árbol de archivos propuesto

```
src/components/onboarding/
├── WizardModal.tsx             # Shell del wizard: overlay + paso activo
├── OnboardingProvider.tsx      # Context: step actual, dispatch, polling
├── steps/
│   ├── Welcome.tsx             # Paso 1
│   ├── CompanyInfo.tsx         # Paso 2
│   ├── TelcelCreds.tsx         # Paso 3
│   ├── CarteraImport.tsx       # Paso 4 (polling scrape status)
│   ├── PrimerCotizacion.tsx    # Paso 5
│   ├── LeerVeredicto.tsx       # Paso 6
│   └── InvitarEquipo.tsx       # Paso 7
├── TrialBanner.tsx             # Banner días restantes
├── UpgradePrompt.tsx           # Modal bloqueante al expirar trial
└── HelpButton.tsx              # Botón flotante de ayuda post-wizard
```

### Especificaciones por componente

#### `WizardModal.tsx`
- Props: `isOpen: boolean`, `onClose: () => void`, `initialStep: number`
- Renderiza el paso activo como children según `currentStep`
- Maneja el estado global de onboarding via `OnboardingProvider`
- Montado en `DashboardLayout` cuando `onboarding.completed_at == null`
- El botón "Saltar" en cada paso llama a `POST /api/onboarding/step` con `skipped: true` y avanza
- Botón X solo visible a partir del paso 2; al cerrar, guarda el paso actual en el servidor

#### `OnboardingProvider.tsx`
- Context con: `{ step, setStep, skipped, dispatch, loading }`
- Al montar: `GET /api/onboarding/status` para restaurar estado
- Expone `advanceStep(stepData)` que hace `POST /api/onboarding/step` y actualiza estado local

#### `steps/Welcome.tsx`
- Props: `userName: string`, `trialDays: number`
- Muestra: nombre del distribuidor, días de prueba, ilustración animada
- Dispatcha: `advanceStep({ step: 1 })` al hacer click en "Empezar"
- Sin inputs, sin validación

#### `steps/CompanyInfo.tsx`
- Props: `initialData: { company_name, contact_name, city, logo_url }`
- Inputs: nombre comercial (pre-llenado del signup), nombre del responsable, ciudad, upload de logo
- Validación inline: nombre comercial requerido (mínimo 2 chars), archivo logo < 2MB, PNG/JPG
- Al submit: `PUT /api/tenant/profile` (endpoint nuevo) + `advanceStep({ step: 2, data })`
- Loading state mientras sube el logo

#### `steps/TelcelCreds.tsx`
- Props: `hasCreds: boolean` (pre-verificar si ya tiene creds del paso de configuracion)
- Inputs: email, password (con toggle show/hide)
- Al submit: `POST /api/tenant/credentials` (endpoint existente) + verificación de login
- Si ya tiene creds → "Ya tienes credenciales configuradas. ¿Actualizarlas?" con opciones Actualizar / Continuar
- Loading state: "Verificando con Telcel..." 20-30s
- Error inline si las creds son incorrectas
- Botón "Saltar" bien visible

#### `steps/CarteraImport.tsx`
- Props: `hasCreds: boolean`, `jobId: string | null`
- Si no hay creds (paso 3 saltado): mostrar mensaje informativo + botón "Continuar"
- Si hay creds: lanzar `POST /api/cartera/enqueue` al montar el paso (si no hay jobId ya)
- Pollear `GET /api/cartera/status?job_id=X` cada 5 segundos
- Mostrar barra de progreso basada en `progress` del job
- Timeout tras 5 minutos: "Sigue importando en segundo plano. Continúa."
- Al completarse: mostrar "X clientes importados" + botón Continuar

#### `steps/PrimerCotizacion.tsx`
- Props: `sampleCliente: { rfc, lineas }`, `hasCreds: boolean`
- Si hay cartera importada: mostrar dropdown con clientes reales del tenant
- Si no hay cartera: pre-llenar con RFC de demo (`LUFJ831214AHA`)
- Al cotizar: llamar a `POST /api/cotizar` (endpoint existente)
- Polling de resultado cada 3s (cotizaciones son asíncronas, 2-5 min)
- Al completar: mostrar folio + monto + botones "Ver PDF" / "Continuar"
- Botón "Saltar — cotizo después" siempre visible

#### `steps/LeerVeredicto.tsx`
- Props: `quoteResult: CotizacionResult | null`
- Informativo puro: explica PDF cliente vs PDF interno vs A/B
- Si hay `quoteResult` del paso anterior: destacar los números con tooltip highlight
- Sin inputs
- CTA único: "Entendido →"

#### `steps/InvitarEquipo.tsx`
- Props: `inviteLink: string`, `tenantId: string`
- Input email con botón "+ Agregar" → lista de invitados con × quitar
- Botón "Copiar link" para el invite link del tenant
- Al hacer click "Finalizar": `POST /api/onboarding/complete` + `POST /api/v1/onboarding/invite` si hay emails
- Pantalla de celebración inline (confetti animado, framer-motion) antes de cerrar el modal

#### `TrialBanner.tsx`
- Props: `trialEndsAt: string`, `plan: string`
- Solo visible si `subscription_status === "trialing"`
- Muestra días restantes calculados en tiempo real
- CTA "Activar plan" → `/dashboard/billing`
- Se oculta si `subscription_status === "active"`
- Posición: debajo del header del Sidebar, arriba del contenido principal

```
┌─────────────────────────────────────────────────────────────────┐
│ ⏱ Prueba gratuita · 11 días restantes   [Activar plan →]      │
└─────────────────────────────────────────────────────────────────┘
```

#### `UpgradePrompt.tsx`
- Props: `reason: "trial_expired" | "past_due"`
- Modal con backdrop no-dismissible (no se puede cerrar sin pagar)
- Muestra los 3 planes con precios (mismo diseño que billing/page.tsx)
- CTA "Ver planes" → `/dashboard/billing`
- Link de excepción: "Hablar con soporte" → Telegram/Instagram

#### `HelpButton.tsx`
- Props: `context: string` (ruta actual)
- Botón flotante fijo bottom-left (para no chocar con Aria que está bottom-right)
- Click → abre panel con:
  - "Ver el tour de nuevo" (re-lanza WizardModal desde paso 1)
  - "Manual del distribuidor" (PDF)
  - "Soporte por Instagram"
  - "Soporte por Telegram"

---

## E. Estado Global del Onboarding

### E.1 Schema en tenant_config (backend)

```python
ONBOARDING_DEFAULTS = {
    "current_step": 1,       # int 1-7
    "completed_at": None,    # ISO string o None
    "skipped": [],           # list[int] — pasos saltados
    "company_display_name": "",
    "contact_name": "",
    "city": "",
    "logo_url": None,
    "first_quote_id": None,
}
```

### E.2 Endpoints de estado

```
GET  /api/v1/onboarding/status
POST /api/v1/onboarding/step      { step, skipped, data }
POST /api/v1/onboarding/complete  {}
```

### E.3 Estado en el frontend

El `OnboardingProvider` mantiene en memoria:

```typescript
interface OnboardingState {
  currentStep: number;         // 1-7
  completedAt: string | null;
  skipped: number[];
  isLoading: boolean;
  error: string | null;
}
```

Al cambiar de página (Next.js navigation), el estado persiste via `sessionStorage` como fallback, pero el source of truth es el servidor.

### E.4 Trigger del wizard en DashboardLayout

```typescript
// En DashboardLayout (server component)
const onboarding = await getOnboardingStatus(session.tenant_id);
const showWizard = !onboarding.completed_at;

return (
  <>
    {children}
    {showWizard && <WizardModal initialStep={onboarding.current_step} />}
    <TrialBanner trialEndsAt={subscription.trial_ends_at} />
    <AriaCopilot userName={userName} />
    <HelpButton />
  </>
);
```

---

## F. Emails — Templates y Triggers

### Email 1 — Bienvenida (Day 0)

- **Subject:** `¡Tu cotizador está listo! Empieza a cotizar hoy — {{nombre_distribuidor}}`
- **Trigger:** `POST /api/onboarding/complete` completado
- **Variables:** `{{user_name}}`, `{{trial_ends_at}}`, `{{dashboard_url}}`
- **CTA principal:** "Ir al dashboard →"

```
Hola {{user_name}},

Configuraste tu cotizador en tiempo récord. 

Tu prueba gratuita está activa hasta el {{trial_ends_at}}.

Lo que puedes hacer ahora:
  → Cotizar para cualquier cliente de tu cartera
  → Descargar PDFs de cotización en segundos
  → Optimizar tus palancas A/B para mejorar márgenes

[Ir al dashboard →]

Si tienes dudas, Aria (el asistente IA) está en el botón ✦
del dashboard. Pregúntale cualquier cosa.

— Equipo Cotizador Inteligente para DATs
```

---

### Email 2 — Recordatorio Day 3

- **Subject:** `{{user_name}}, ¿ya hiciste tu primera cotización?`
- **Trigger:** Job APScheduler, 3 días después de `onboarding.completed_at`
- **Condición:** Solo si `first_quote_id == null` (nunca cotizó)
- **Variables:** `{{user_name}}`, `{{trial_days_remaining}}`, `{{dashboard_url}}`
- **CTA principal:** "Hacer mi primera cotización →"

```
Hola {{user_name}},

Llevas 3 días con tu cotizador y aún no has generado
ninguna cotización. Puede que sea un buen momento.

[Hacer mi primera cotización →]

Toma 3-5 minutos. El PDF queda guardado automáticamente.

Te quedan {{trial_days_remaining}} días de prueba gratuita.

— Equipo Cotizador Inteligente para DATs
```

---

### Email 3 — Mid-trial Day 7

- **Subject:** `Estás a la mitad de tu prueba — ¿qué tal va?`
- **Trigger:** Job APScheduler, 7 días después de `signup_approved_at`
- **Variables:** `{{user_name}}`, `{{trial_days_remaining}}`, `{{cotizaciones_count}}`, `{{plan_recommended}}`
- **CTA principal:** "Ver mis cotizaciones →"

```
Hola {{user_name}},

Ya van 7 días de prueba. Has generado {{cotizaciones_count}}
cotizaciones hasta ahora.

Con base en tu uso, te recomendamos el plan {{plan_recommended}}.

Te quedan {{trial_days_remaining}} días de prueba.

[Ver mis cotizaciones →]    [Activar plan →]

— Equipo Cotizador Inteligente para DATs
```

---

### Email 4 — Urgencia Day 12

- **Subject:** `Solo {{trial_days_remaining}} días de prueba restantes, {{user_name}}`
- **Trigger:** Job APScheduler, 12 días después del signup
- **Variables:** `{{user_name}}`, `{{trial_days_remaining}}`, `{{plan_recommended}}`, `{{plan_price}}`
- **CTA principal:** "Activar mi plan →"

```
Hola {{user_name}},

Tu prueba gratuita vence en {{trial_days_remaining}} días.

Para no perder acceso a tus cotizaciones y la cartera importada,
activa tu plan antes del vencimiento.

Plan recomendado para ti: {{plan_recommended}} — ${{plan_price}} MXN/mes

[Activar mi plan →]

¿Preguntas sobre el plan? Escríbenos a hjtm81@gmail.com.

— Equipo Cotizador Inteligente para DATs
```

---

### Email 5 — Trial Expirado Day 15

- **Subject:** `Tu acceso al cotizador pausado — reactívalo hoy`
- **Trigger:** `expire_stale_tenants()` job diario cuando marca `expired`
- **Variables:** `{{user_name}}`, `{{billing_url}}`
- **CTA principal:** "Reactivar mi cuenta →"

```
Hola {{user_name}},

Tu período de prueba gratuita terminó.

Tu historial de cotizaciones y cartera de clientes está
guardado — no perdiste nada. Solo necesitas activar un plan
para volver a cotizar.

[Reactivar mi cuenta →]

Planes desde $999 MXN/mes.

— Equipo Cotizador Inteligente para DATs
```

---

## G. Tour Re-Launchable

### Entrada desde Configuración

En `/dashboard/configuracion/page.tsx`, agregar sección "Ayuda y tour":

```
┌──────────────────────────────────────────────────────┐
│  🎯 Tour del cotizador                               │
│  Vuelve a ver la configuración inicial paso a paso.  │
│                                                      │
│  [Ver el tour de nuevo →]                            │
└──────────────────────────────────────────────────────┘
```

Al hacer click: `POST /api/onboarding/reset` (endpoint nuevo, solo resetea `completed_at` a null, no borra datos). El WizardModal se lanzará al siguiente refresh/navegación.

### Implementación sin librería externa

La implementación recomendada es **sin driver.js** (agrega 60KB+ al bundle). En cambio:

1. `WizardModal` acepta prop `isRelaunch: boolean`.
2. Al relanzar, el `current_step` se resetea a 1 en el servidor y el modal abre en paso 1.
3. Los datos de los pasos ya completados se pre-llenan (no se borran).
4. El botón "Saltar" en el relanzamiento lleva directamente al dashboard.

Esto es más ligero y coherente con el diseño existente (no necesitamos tooltips flotantes sobre la UI real — el modal ya es la guía).

Si en el futuro se quiere un tour con highlights sobre la UI real (sin modal), **driver.js** es la opción correcta. Ese scope es Sprint 4+.

---

## H. Métricas / Analytics

### Funnel de conversión a trackear

```
signup_submitted
  → signup_approved (% conversión, tiempo promedio si manual)
  → wizard_started (paso 1 completado)
  → wizard_step_2_completed
  → wizard_step_3_completed (creds Telcel)
  → wizard_step_3_skipped
  → cartera_imported (success)
  → cartera_import_failed
  → first_quote_completed
  → wizard_completed
  → trial_day_3_active (ha cotizado al menos 1 vez)
  → trial_day_7_active
  → plan_upgrade_clicked
  → plan_upgrade_completed (Stripe webhook)
```

### Implementación

Evento trackeable con un endpoint interno `POST /api/analytics/event`:

```python
{ 
  "event": "wizard_step_3_completed",
  "tenant_id": "huvasi",
  "properties": { "step": 3, "skipped": false }
}
```

Los eventos se escriben en `data/analytics_events.jsonl` (append-only). Dashboard de Hector puede mostrar el funnel.

### Preguntas clave a responder

- ¿En qué paso abandonan más? (hipótesis: paso 3 — creds Telcel — tiene más fricción)
- ¿Cuántos días después del wizard se hace la primera cotización?
- ¿Cuál es la tasa de conversión trial → pago por cohorte semanal?
- ¿Los usuarios que completan el wizard tienen mayor retención?

---

## I. Estimación de Esfuerzo

| Stage | Componente / Endpoint | Horas | Complejidad |
|---|---|---|---|
| Backend signup auto-aprobación | `api_server.py` `AUTO_APPROVE_SIGNUPS` | 2h | Low |
| Backend onboarding schema | `subscription_manager.py` + `tenant_config` | 2h | Low |
| Backend endpoints /onboarding/* | `api_server.py` 3 endpoints nuevos | 4h | Medium |
| Backend endpoint `/tenant/profile` | subir logo, nombre, etc. | 3h | Medium |
| Validación de creds Telcel (login check) | adaptador Playwright rápido | 4h | High |
| `WizardModal.tsx` + `OnboardingProvider.tsx` | shell + context | 4h | Medium |
| Paso 1 Welcome.tsx | trivial | 1h | Low |
| Paso 2 CompanyInfo.tsx + upload logo | 3h | Medium |
| Paso 3 TelcelCreds.tsx | 2h | Low (endpoint existe) |
| Paso 4 CarteraImport.tsx + polling | 3h | Medium |
| Paso 5 PrimerCotizacion.tsx + polling | 4h | High |
| Paso 6 LeerVeredicto.tsx | 1h | Low |
| Paso 7 InvitarEquipo.tsx | 3h | Medium |
| `TrialBanner.tsx` | 2h | Low |
| `UpgradePrompt.tsx` | 2h | Low |
| `HelpButton.tsx` | 1h | Low |
| DashboardLayout integración wizard | 1h | Low |
| Emails Day-3, Day-7, Day-12, Day-15 | `signup_emails.py` + APScheduler | 4h | Medium |
| Tour re-launchable + reset endpoint | 2h | Low |
| Analytics eventos | 3h | Medium |
| **TOTAL** | | **~51h** | |

Estimado real con buffer de integración y pruebas: **~65-70h ≈ 8-9 días de trabajo de 1 dev**.

---

## J. Plan de Implementación por Sprints

### Sprint 1 — Fundación (2 días, ~16h)

Objetivo: Nuevo usuario puede crear cuenta, entrar al dashboard, y ver el wizard hasta el paso 3.

1. Backend: flag `AUTO_APPROVE_SIGNUPS` + onboarding schema en tenant_config.
2. Backend: endpoints `/api/onboarding/status`, `/api/onboarding/step`, `/api/onboarding/complete`.
3. Frontend: `WizardModal` + `OnboardingProvider` + pasos 1, 2, 3.
4. Frontend: integración en `DashboardLayout` (mount condicional del wizard).
5. Prueba: signup → login → modal aparece → pasos 1-3 funcionan.

**Criterio de éxito:** Un visitante puede registrarse, entrar al dashboard, y completar los pasos 1-3 del wizard sin intervención de Hector.

---

### Sprint 2 — Cartera + Primera Cotización + Emails (2 días, ~18h)

Objetivo: Pasos 4-7 completos + emails automáticos.

1. Frontend: pasos 4 (polling cartera), 5 (primera cotización), 6, 7.
2. Backend: auto-trigger de `cartera_scraper.enqueue_job` al guardar creds.
3. Backend: endpoint `/api/cartera/status` para polling del frontend.
4. Emails: templates Day-0, Day-3, Day-7, Day-12, Day-15 en `signup_emails.py`.
5. APScheduler: jobs de email automáticos.

**Criterio de éxito:** Usuario completa el wizard de 7 pasos en < 10 minutos. Recibe email Day-0.

---

### Sprint 3 — Trial Banner + Upgrade + Tour + Analytics (1 día, ~10h)

Objetivo: Monetización visible + analytics básico.

1. Frontend: `TrialBanner`, `UpgradePrompt`, `HelpButton`.
2. Backend: tour re-launchable (reset endpoint).
3. Configuración: sección "Ver el tour de nuevo" en `/dashboard/configuracion`.
4. Analytics: `POST /api/analytics/event` + logging en JSONL.
5. Polish: animaciones, responsive mobile, a11y básico.

**Criterio de éxito:** Trial banner visible. Al expirar el trial, `UpgradePrompt` bloquea acceso. Analytics registra el funnel completo.

---

## Decisiones que Hector debe tomar antes de implementar

1. **¿Auto-aprobación activada por defecto?** ¿O mantener aprobación manual de Hector con un timeout (ej: si no aprueba en 1h, se aprueba automático)? Impacto en Sprint 1.

2. **¿Trial de 14 días o 30 días?** El `subscription_manager.py` actual usa 30 días. La landing dice "14 días". Hay que alinear.

3. **¿Validación real de creds Telcel en el wizard?** La validación real (login check con Playwright) agrega 4h y puede fallar por timeouts del portal. Alternativa: guardar las creds sin validar y que fallen al cotizar. ¿Vale la pena la fricción adicional en el wizard?

4. **¿Upload de logo?** ¿Dónde se almacena? (S3 / Cloudflare R2 / disco del servidor Fly.io). Hay que decidir el storage antes de implementar CompanyInfo.tsx.

5. **¿Invitación de vendedores en el wizard?** ¿O simplemente mostrar el link de invite del tenant? El sistema de invites ya existe (via Telegram), pero el flujo web está pendiente.
