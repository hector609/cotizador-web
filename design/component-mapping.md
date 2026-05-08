# Component Mapping — emojis e iconos viejos a reemplazar

Inventario por archivo de cada elemento decorativo (emoji, dot de color, SVG inline ad-hoc, wrapper hand-rolled) que debe migrarse a la nueva biblioteca.

Convenciones de la columna **Nuevo**:
- `<Icon>` = componente exportado desde `@/components/icons`.
- `<Section>`, `<Badge>`, `<TrustSignals>` = primitivos de `@/components/ui/*`.
- `inline-svg` = svg específico (logo, glyph) que se queda inline pero documentado.

---

## `src/app/page.tsx` (landing)

| Línea | Actual | Nuevo | Nota |
|---|---|---|---|
| 7-9 | `<div ...>Cotizador Inteligente para DATS</div>` (eyebrow pill ad-hoc) | `<Badge variant="primary">` | Mantiene apariencia, queda canónica. |
| 24 | Texto `Solicitar acceso →` (flecha unicode) | `Solicitar acceso <ArrowRightIcon className="w-4 h-4 ml-2" />` | El glifo unicode `→` rinde inconsistente entre OS. |
| 32-39 | Link "¿Prefieres Telegram?" sin icono | Prefijar con `<DevicePhoneMobileIcon className="w-4 h-4" />` | Refuerza canal alternativo de forma visual. |
| 43-58 | Trust signals con 3 dots `bg-green-500` separados por `·` | `<TrustSignals items=[MapPinIcon, LockClosedIcon, CheckCircleIcon]>` | Sustituye dots por iconos semánticos. Ver style-guide §5.10. |
| 63 | `title: "🎯 Multi-distribuidor"` | `icon: UsersIcon`, separar `title` y `icon` en el shape | Emoji fuera. `🎯` = "objetivo", pero la idea es "varios usuarios". |
| 67 | `title: "⚡ Rápido"` | `icon: BoltIcon`, title `"Rápido"` o mejor `"Cotizaciones en minutos"` | El emoji de rayo se convierte en BoltIcon. |
| 71 | `title: "📊 Calibrador A/B"` | `icon: ChartBarIcon`, title `"Calibrador A/B"` | `📊` ya no necesario; ChartBarIcon transmite lo mismo con peso B2B. |
| 75-82 | Render de `f.title` plano | Card refactor: icono `w-8 h-8 text-blue-700` arriba, luego `<h3>` sin emoji | Patrón estándar de feature cards. |
| 60 | Grid sin `<Section>` wrapper, `mt-20` arbitrario | Envolver todo bajo `<Section>` o al menos las features con `space-section-md` | Estandariza spacing hero → features. |
| 94-96 | SVG inline de Instagram (logo de marca de terceros) | **Mantener inline** | Logos de redes externas no van a la lib genérica. Documentado: ver style-guide. |

---

## `src/app/precios/page.tsx`

| Línea | Actual | Nuevo | Nota |
|---|---|---|---|
| 102 | `← Hectoria` (flecha unicode) | `<ArrowRightIcon className="w-4 h-4 rotate-180 mr-2" />` + `Hectoria` | Consistencia con resto. |
| 108 | `Iniciar sesión →` | `Iniciar sesión <ArrowRightIcon className="w-4 h-4 ml-2" />` | Idem. |
| 114-127 | Hero hand-rolled (`<section>` + `max-w-4xl mx-auto px-6 pt-16 pb-12`) | `<Section width="default" spacing="md" bg="gradient">` + alinear `text-center` interno | Hereda del wrapper. |
| 115-117 | Eyebrow pill ad-hoc "Planes y precios" | `<Badge variant="primary">Planes y precios</Badge>` | Idem landing. |
| 130-147 | Trust signals duplicados (mismo bloque que landing) | `<TrustSignals items={...} />` | DRY. |
| 134, 140, 145 | Tres `bg-green-500` dots | Removidos por icono semántico via `<TrustSignals>` | Ver style-guide §5.10. |
| 159-162 | Pill "Más popular" hand-rolled (`absolute -top-3 ...`) | Mantener wrapper de posicionamiento, pero contenido = `<Badge variant="primary" size="md">Más popular</Badge>` | El badge es contenido; el `absolute` es layout, queda. |
| 177-189 | SVG inline de checkmark con `strokeWidth=2.5` | `<CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />` | Ojo: el actual es trazo grueso para listas — el `CheckCircleIcon` outline funciona igual; si se prefiere check sin círculo, agregar `CheckIcon` a la lib. |
| 222-224, 271-273 | `<section>` + `max-w-XXL mx-auto px-6 py-20` repetidos | `<Section bg="white" spacing="md">`, `<Section bg="slate" spacing="md" width="narrow">` | 2 variantes de wrapper se vuelven props. |
| 224-227 | Eyebrow "Roadmap 2026" pill ad-hoc | `<Badge variant="primary">Roadmap 2026</Badge>` | Idem. |
| 259 | `<span>›</span>` glyph como bullet | `<ArrowRightIcon className="w-3 h-3 text-blue-700 mt-1" />` o mantener glifo si AAA | El `›` queda OK pero es inconsistente con el resto del sistema. |
| 274-276 | Eyebrow "Preguntas frecuentes" pill ad-hoc | `<Badge variant="primary">Preguntas frecuentes</Badge>` | Idem. |
| 308-312 | Botón `+` para FAQ | Cambiar por `<ChevronDownIcon>` con `group-open:rotate-180` (agregar a lib si se aprueba) | El `+` rotando funciona, pero `chevron-down` es la convención FAQ. **Decisión pendiente.** |
| 324-339 | CTA strip hand-rolled `bg-gradient-to-br from-blue-700 to-blue-900` | `<Section bg="dark" spacing="sm">` | Mismo gradiente, ahora token. |
| 336 | `Iniciar sesión →` | `Iniciar sesión <ArrowRightIcon />` | Idem. |
| 44-45 | Texto features `"(próximamente)"` plano | Considerar `<Badge variant="muted" size="sm">Próximamente</Badge>` después de la feature | Dependiendo de cómo lea, puede engordar la lista. **Sugerencia P2.** |

---

## `src/app/login/page.tsx`

| Línea | Actual | Nuevo | Nota |
|---|---|---|---|
| 104 | `← Volver` | `<ArrowRightIcon className="w-4 h-4 rotate-180 mr-1" /> Volver` | Idem. |
| 124 | `o con email` separador hand-rolled | Considerar primitivo `<Divider label="o con email" />` (no en este sprint) | OK como está. |
| n/a | No hay trust signals en login | **Sugerir agregar** `<TrustSignals>` debajo del form (3 items) | Reduce ansiedad de "¿es legítimo?" antes de enviar credenciales. **P1.** |
| 136 | Input email con icono opcional | Considerar prefijar input con icono `EnvelopeIcon` (no en lib aún) | **No urgente.** |
| 144 | Input password | Idem `LockClosedIcon` prefijado | **No urgente.** |

---

## `src/app/dashboard/page.tsx`

| Línea | Actual | Nuevo | Nota |
|---|---|---|---|
| 9-32 | `<header>` hand-rolled con nav | Mantener (componente Nav futuro fuera del scope). | El header del dashboard es interfaz interna, distinto del marketing. |
| 41-49 | SVG inline de paper-plane (Telegram) | Migrar a `<TelegramIcon>` específica en la lib (logo de marca, conviene aislar) | El glyph es del logo de Telegram — agregar al icons/index como excepción documentada o mantener inline. **Decisión: mantener inline + comentar `// brand: Telegram logo` para que no se confunda con icono genérico.** |
| 65 | `Abrir bot <span aria-hidden>→</span>` | `Abrir bot <ArrowRightIcon className="w-4 h-4" />` | Idem. |
| 40-70 | Hero card gradient hand-rolled | Posible `<HeroCard>` primitivo en futuro, no en este sprint | Es único patrón en el dashboard; no urgente DRY. |
| 73-95 | Cards "Mis clientes" / "Cotizar ahora" sin iconos | Prefijar cada `<h4>` con `<UsersIcon />` y `<DocumentTextIcon />` respectivamente, `w-5 h-5 text-blue-700 mb-2` | Refuerza navegación. **P2.** |

---

## `src/app/dashboard/clientes/page.tsx`

| Línea | Actual | Nuevo | Nota |
|---|---|---|---|
| 64-86 | Header / nav hand-rolled (duplicado del dashboard root) | Extraer `<DashboardNav>` (out of scope este sprint) | Pendiente refactor — no toques en este PR. |
| 100-106 | Botón "Refrescar" sin icono | Prefijar con `<ArrowPathIcon>` (agregar a lib si se aprueba) | **P2.** Mejora affordance del botón refrescar. |
| 109-119 | Banner de error con texto plano | Prefijar el texto con icono `<ExclamationTriangleIcon>` (agregar a lib) | **P2.** Patrón estándar de banners. |
| 123-130 | Input search sin icono | Prefijar con `<MagnifyingGlassIcon>` (agregar a lib) | **P1.** Affordance estándar de search. |
| 132-137 | Skeleton `animate-pulse` rectángulos | OK. Mantener. | Ver style-guide §5: pulse permitido en skeletons. |
| 138-141 | Empty state texto plano | Prefijar con `<UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-4">` | **P1.** Empty states sin icono leen sosos. |
| 162-168 | Botón "Cotizar para este cliente" texto plano | Prefijar con `<DocumentTextIcon className="w-3.5 h-3.5 mr-1" />` | **P2.** |

---

## Inventario de iconos que faltan en la lib (sugeridos)

Si el equipo decide ejecutar las P1/P2 de arriba, agregar a `@/components/icons`:

| Icono | Uso planeado |
|---|---|
| `ChevronDownIcon` | FAQ disclosure, dropdowns. |
| `EnvelopeIcon` | Input email, mailto. |
| `MagnifyingGlassIcon` | Search input en `/dashboard/clientes`. |
| `ArrowPathIcon` | Botón "Refrescar". |
| `ExclamationTriangleIcon` | Banners de error/warning. |
| `CheckIcon` | Lista de features de planes (sin círculo). Opcional si CheckCircleIcon resulta visualmente pesado. |

> Antes de agregar más: confirmar que cada uno tiene al menos 2 usos planeados. La lib no debe inflarse "por si acaso".
