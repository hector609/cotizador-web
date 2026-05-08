# Cotizador Inteligente — Style Guide

Audiencia: distribuidores autorizados de telecom (DATS) en México. El tono visual debe transmitir **confiabilidad bancaria** sin caer en frialdad corporativa: somos software que toca cartera de clientes corporativos y datos fiscales (RFC), no una landing de growth-hack.

> Regla de oro: si una decisión visual no se puede justificar con "esto baja la fricción de un dueño-DAT que evalúa si confiarnos su cartera", no entra.

---

## 1. Paleta — Tokens

Tailwind tokens reales en uso. **No introducir colores nuevos sin actualizar este doc.**

### Marca

| Token | Tailwind | Uso |
|---|---|---|
| `brand-primary` | `blue-700` (#1d4ed8) | CTAs primarios, headings de acento, links activos, iconos de trust |
| `brand-primary-hover` | `blue-800` (#1e40af) | Hover de CTAs primarios |
| `brand-primary-deep` | `blue-900` (#1e3a8a) | Final del gradiente del CTA strip |
| `brand-tint` | `blue-100` (#dbeafe) | Pill/badge backgrounds (`primary` variant) |
| `brand-tint-soft` | `blue-50` (#eff6ff) | Background de hero gradient, hover de botones secundarios |

> No usamos `blue-500` ni `blue-600` en la marca. El 700 es el ancla — saltar al 600 alegra el tono y nos hace ver más "consumer".

### Texto

| Token | Tailwind | Uso |
|---|---|---|
| `text-primary` | `slate-900` | Headings, números grandes |
| `text-body` | `slate-700` | Body copy en cards/listas |
| `text-secondary` | `slate-600` | Subtítulos, descripciones |
| `text-muted` | `slate-500` | Disclaimers, footnotes, placeholders |
| `text-disabled` | `slate-400` | Estados deshabilitados |

### Surfaces

| Token | Tailwind | Uso |
|---|---|---|
| `surface` | `white` | Cards, modales, nav |
| `surface-soft` | `slate-50` | Section backgrounds alternativos |
| `surface-hero` | `bg-gradient-to-br from-slate-50 to-blue-50` | **Solo** hero de landing y `/precios`, y `/login` |
| `surface-cta` | `bg-gradient-to-br from-blue-700 to-blue-900` | CTA strip final + tarjeta destacada del dashboard |
| `border-default` | `slate-200` | Cards, separadores |
| `border-emphasis` | `blue-700` | Borde del plan destacado, focus rings (`blue-500` para inputs) |

### Estado

| Token | Tailwind | Uso |
|---|---|---|
| `success` | `green-600` (texto), `green-500` (dots) | Checkmarks de features, trust dots (a deprecar) |
| `danger` | `red-600` / `red-50` / `red-200` | Errores de form, banners de error |
| `warning` | `amber-800` / `amber-100` | Badge `warning` solamente. No usar en banners aún. |

---

## 2. Tipografía

**Familia:** Geist (variable, configurada en `layout.tsx`). Cuerpo y heading comparten familia — el peso y el tracking hacen el contraste.

### Jerarquía

| Nivel | Clases Tailwind | Cuándo |
|---|---|---|
| **Display / Hero H1** | `text-5xl md:text-6xl font-bold tracking-tight text-slate-900` | Solo landing hero. Una vez por página. |
| **Page H1** | `text-4xl md:text-5xl font-bold tracking-tight text-slate-900` | Hero de subpáginas (`/precios`). |
| **Section H2** | `text-3xl md:text-4xl font-bold tracking-tight text-slate-900` | Secciones dentro de página larga. |
| **Card H3** | `text-xl font-bold text-slate-900` | Títulos de cards de plan/feature. |
| **Card H4** | `font-semibold text-slate-900` (text-base implícito) | Sub-cards (mis clientes, cotizar). |
| **Eyebrow / Pill** | `text-xs font-semibold uppercase tracking-wider text-blue-700` | Encima de H1/H2. Usa `<Badge variant="primary">` ahora. |
| **Lead** | `text-xl text-slate-600` | Subtítulo del hero principal. |
| **Body** | `text-base text-slate-700` *(o `text-sm` en cards densas)* | Párrafos de feature, FAQ. |
| **Small / Caption** | `text-xs text-slate-500` | Disclaimers, timestamps, "MXN/mes". |
| **Mono** | `font-mono` | Solo RFCs y otros identificadores que se copian. |

### Reglas

- **Tracking:** todo H1/H2 lleva `tracking-tight`. H3 y abajo: tracking default.
- **Leading:** body copy de párrafos usa `leading-relaxed` cuando supera 2 líneas. Headings: leading default.
- **Line length:** subtítulos del hero limitados con `max-w-2xl mx-auto` (≈ 60–70 caracteres). Nunca subtítulo que cruce todo el ancho.
- **Mayúsculas:** solo en eyebrows/badges con `tracking-wider`. Nunca en H1/H2.

---

## 3. Spacing scale

Basada en 8pt + escalado responsive. Las páginas hoy mezclan `py-12`, `py-16`, `py-20` — **estandarizar via `<Section>`**.

| Token | Clases | Cuándo |
|---|---|---|
| `space-section-sm` | `py-12 md:py-16` | Secciones cortas (FAQ corto, footer sup). |
| `space-section-md` | `py-16 md:py-20` | **Default.** Mayoría de secciones de marketing. |
| `space-section-lg` | `py-20 md:py-28` | Hero principal de landing. |
| `space-stack-tight` | `space-y-2` / `gap-2` | Items dentro de card (lista de features). |
| `space-stack-normal` | `space-y-3` / `gap-3` | Lista de features de planes. |
| `space-stack-loose` | `space-y-6` / `gap-6` | Entre cards en grid. |
| `space-inline-sm` | `gap-1.5` | Icono + label inline (trust signals). |
| `space-inline-md` | `gap-3` | Botones del hero. |

**Max-widths** (vía `<Section width>`):

- `narrow` → `max-w-3xl` — FAQ, copy legal, formularios.
- `default` → `max-w-6xl` — el resto.
- `wide` → `max-w-7xl` — solo dashboard interno con tablas.

---

## 4. Reglas de aplicación

### Sombras

- `shadow-sm` — cards en surface blanca sobre `slate-50`. Default para tarjetas de plan no destacadas, mis clientes, FAQ abierto.
- `shadow-md` — botón primario `bg-blue-700`. **Solo el botón — no la card.**
- `shadow-lg` — botón blanco sobre fondo oscuro (CTA strip), tarjeta destacada del dashboard, plan "Más popular".
- `shadow-xl` — **solo** plan destacado (`/precios`).
- **Nunca** `shadow-2xl` ni `drop-shadow` en marketing. Sombras grandes leen "consumer/SaaS genérico".

### Borders

- `border border-slate-200` — separación neutral entre card y fondo. Default.
- `border-2 border-blue-700` — solo el plan "Más popular" + botones secundarios outline. **Único uso de `border-2` en marketing.**
- `border-t border-slate-200` — entre secciones cuando NO cambia el fondo.
- **No** mezclar `border` + `shadow-md` en la misma card — elige uno.

### Gradientes

Solo dos gradientes vivos en el sistema, ambos diagonales:

1. `bg-gradient-to-br from-slate-50 to-blue-50` — hero / surface respiración.
2. `bg-gradient-to-br from-blue-700 to-blue-900` — CTA strip + hero card del dashboard.

**No** introducir gradientes a `purple`, `cyan`, `pink` ni multi-stop. Eso es lenguaje consumer; rompe la promesa "B2B serio".

### Radios

- `rounded-lg` (8px) — **default** para botones, inputs.
- `rounded-xl` (12px) — cards pequeñas, FAQ, banners de error.
- `rounded-2xl` (16px) — cards de plan, hero card del dashboard. **Máximo radio del sistema.**
- `rounded-full` — pills de badge, dots, avatares.

### Iconografía

- Heroicons outline 24×24, stroke 1.5, vía `@/components/icons`. **Nunca** emojis en titulares ni en cards de marketing — emojis están permitidos solo en presenter notes / docs internas.
- Tamaño default: `w-5 h-5` inline con texto, `w-6 h-6` en feature cards, `w-8 h-8` para icono hero. **Nunca** `w-4 h-4` excepto en trust signals row.
- Color: hereda `currentColor`. En features = `text-blue-700`. En check de planes = `text-green-600`. En trust signals = `text-blue-700`.

### Animación / Hover

- Botones: `transition` (≈150ms) + cambio de bg. **Sin scale.**
- Cards de plan: nada en hover. `md:scale-105` del plan destacado es estado de reposo, NO hover.
- Cards de dashboard: `hover:border-blue-400 hover:shadow-sm` — aceptable, sutil.
- `<details>`: rotación de `+` con `group-open:rotate-45`. Bien.

---

## 5. NO hacer (lista negra)

Decisiones que rompen la lectura "B2B serio mexicano":

1. **Emojis en titulares o feature cards.** (`🎯 Multi-distribuidor`, `⚡ Rápido`, `📊 Calibrador`). Emoji = informalidad de chat — incompatible con audiencia que firma contrato.
2. **Gradientes saturados o multi-stop** (`from-purple-500 via-pink-500 to-orange-500`). Lenguaje de consumer / dApp.
3. **`scale-105` o más en hover de cards.** Hace ver el sitio inseguro — micro-rebote = "mírame". `md:scale-105` como reposo del plan destacado es la única excepción.
4. **Animaciones de entrada (`animate-bounce`, `animate-pulse` decorativo).** Solo `animate-pulse` en skeletons de loading.
5. **Sombras de color** (`shadow-blue-500/50`). Nunca.
6. **Más de 2 fuentes / pesos no estándar.** Solo Geist con weights 400, 500, 600, 700. No `font-extrabold`, no `font-black`.
7. **Texto centrado en columnas largas (`text-center` + `max-w-3xl+`).** El centrado solo en heros y CTAs; body de FAQ y cards va alineado a la izquierda.
8. **Borders punteados / dashed.** Lectura de "wireframe" o "draft".
9. **Iconos rellenos (Heroicons solid)** en marketing. Solo outline. Solid únicamente para estados activos (ej. star llena de "favorito") — hoy no aplica.
10. **Verde `green-500` como acento de marca.** Verde = confirmación binaria (check, dot OK), no decoración. Bajar uso del dot verde en trust signals — sustituir por `MapPinIcon`/`LockClosedIcon`/`CheckCircleIcon` con `text-blue-700`.
11. **`text-shadow` o `backdrop-blur` decorativos.** En marketing nunca; en dashboard solo si hay justificación de legibilidad.
12. **Banners de "Black Friday", contadores regresivos, badges flotantes con `animate-pulse`.** El plan B2B no se vende con escasez artificial.

---

## 6. Ejemplos de uso

### Sección estándar

```tsx
<Section bg="slate" spacing="md">
  <Badge variant="primary">Planes y precios</Badge>
  <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-4">
    Cotiza más rápido
  </h2>
  <p className="text-slate-600 mt-3 max-w-2xl">…</p>
</Section>
```

### Trust signals

```tsx
<TrustSignals
  items={[
    { icon: MapPinIcon, label: "Datos en México" },
    { icon: LockClosedIcon, label: "Cifrado en tránsito" },
    { icon: CheckCircleIcon, label: "Cancela cuando quieras" },
  ]}
/>
```

### Badge "Más popular"

```tsx
<Badge variant="primary" size="md">Más popular</Badge>
```
