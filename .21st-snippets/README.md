# 21st-magic snippets — curated for LUMINA Light Premium pivot

Generated 2026-05-13 via `mcp__21st-magic__21st_magic_component_inspiration`.
These are the PRIMITIVE components agents implementing LUMINA must use literally.
NO fallback a Tailwind genérico — usar estos primitives o variantes muy cercanas.

## Available primitives

### `hero-shapes/` — Hero con floating shapes animados
- Source: 21st `Shape Landing Hero` (Kokonut UI)
- Uses framer-motion `ElegantShape` con rotate + y-translate continuo
- 5 shapes con gradient borders, blur, drop-shadow
- H1 con bg-clip-text gradient
- fadeUpVariants stagger
- npm deps: `framer-motion`, `lucide-react`

### `kpi-cards-recharts/` — KPI cards con AreaChart integrado
- Source: 21st `Animated Stats Cards` (52KB saved en tool-results)
- Cada card: title + period + value + Recharts AreaChart inline + delta chip + icon lucide
- 3 cards: Revenue (emerald), New Customers, Active Users
- ResponsiveContainer + Tooltip + Area smooth gradient fill
- npm deps: `recharts`, `lucide-react`

### `pricing-numberflow/` — Pricing con NumberFlow + toggle billing
- Source: 21st `Pricing Section` (55KB saved en tool-results)
- @number-flow/react para precio animated al switch monthly/yearly
- Sparkles overlay decorativa
- VerticalCutReveal en title text
- TimelineContent stagger en features list
- 3 plan cards, popular highlighted con border + glow
- npm deps: `@number-flow/react`, `motion/react`

### `buttons/`
- `subtle-button.tsx` — border-animated shimmer translate, glow pulse, ripple dot
- `shiny-button.tsx` — 4 variants (default/green/indigo/red), glow tinted gradient
- `neon-button.tsx` — 3D perspective rotateX, shimmer + ripple + bounceIn keyframes

### `sidebar/` — Navigation sidebar animado
- Source: 21st `SessionNavBar` (saved en tool-results)
- framer-motion variants open/closed (15rem ↔ 3rem)
- ScrollArea + Avatar + DropdownMenu + Skeleton
- Active state indicator with layoutId animated
- npm deps: `framer-motion`, `lucide-react`, multiple @radix-ui

### `chat/` — AI Chat con command palette + animated typing dots
- Source: 21st `Animated AI Chat`
- framer-motion AnimatePresence para palette
- Auto-resize textarea hook
- Command suggestions Tab/Arrow nav
- Typing dots stagger animation
- Mouse-follow gradient blur background
- npm deps: `framer-motion`, `lucide-react`

## How to use these in implementation

1. Read these snippets BEFORE writing JSX.
2. Copy the framer-motion variants AS-IS — don't dilute.
3. Adapt color tokens to LUMINA palette (indigo-600 primary, cyan-500 accent, pink-500 pop, white surfaces).
4. Use the same lucide icons or replace 1:1 con Heroicons existentes.
5. INSTALL required npm deps: `framer-motion recharts @number-flow/react motion clsx tailwind-merge`.
6. NO fallback a `bg-blue-700` Tailwind plain — siempre usa gradients o snippet-driven styling.

## Reference paths to read
- Tool results disk: `C:\Users\hjtm\.claude\projects\C--dev-cotizador-telcel\e291b8d7-2af6-4953-b692-79483b26ead5\tool-results\*.json`
- Stitch mockups: `C:\dev\cotizador-telcel\.claude\stitch-html\` (next batch coming)
- LUMINA design system tokens: `mcp__stitch__get_design_system assets/14667745224610794807`
