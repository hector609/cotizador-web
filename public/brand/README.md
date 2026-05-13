# Brand assets — Cotizador (LUMINA)

## Paleta oficial

| Token         | Hex       | Uso                                 |
|---------------|-----------|-------------------------------------|
| indigo-600    | `#4F46E5` | Primary (theme_color, gradients)    |
| cyan-500      | `#06B6D4` | Accent (gradients, hover)           |
| pink-500      | `#EC4899` | Pop (CTAs sparingly)                |
| mint-300      | `#6EE7B7` | Dot accent en iconmark light        |
| slate-900     | `#0F172A` | Wordmark sobre fondo claro          |
| white         | `#FFFFFF` | Wordmark sobre fondo oscuro         |

## Logos disponibles

- `logo-cotizador-mark.svg` — iconmark 64x64 (favicon, app icon, tile compacto).
- `logo-cotizador-full.svg` — iconmark + wordmark 240x80 sobre fondos claros.
- `logo-cotizador-light.svg` — variante invertida 240x80 sobre fondos oscuros/gradient.

Tipografía wordmark: **Geist 800**, `letter-spacing -0.02em`.

## OG image — TODO (no generada en este patch)

Spec para `public/brand/og.png` (mandar a diseñar o generar con script):

- **Dimensiones**: 1200 x 630 (Open Graph estándar).
- **Background**: gradient diagonal `#4F46E5` → `#06B6D4` (top-left a bottom-right).
- **Wordmark**: "Cotizador" en Geist 800 white, centrado horizontalmente,
  font-size ~120px, letter-spacing -0.02em.
- **Subtítulo**: "Cotiza Telcel en minutos" en Geist 500 white/80, ~32px,
  debajo del wordmark con 24px de separación.
- **Iconmark light** (versión `logo-cotizador-light.svg`) opcional como
  decoración esquina inferior derecha a 88x88, opacity 80%.
- **Safe area**: 80px de padding en todos los bordes.

Referencia en `src/app/layout.tsx` ya apunta a `/brand/og.png` — al crearlo
no requiere cambios de código.

## Iconos PWA

Los `public/icons/icon-{192,512}{,-maskable}.png` actuales fueron generados
en la era branding `#0066b3` (azul Telcel). Pendiente regenerarlos a partir
del nuevo `logo-cotizador-mark.svg` para que la PWA instalada se vea con
LUMINA. Mientras tanto siguen siendo válidos (manifest los referencia y son
PNG), solo desentonan visualmente del nuevo theme_color.

TODO: regenerar `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`,
`icon-512-maskable.png` desde `logo-cotizador-mark.svg`.
