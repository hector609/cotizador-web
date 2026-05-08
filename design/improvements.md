# Top 10 mejoras visuales — priorizadas

Lista accionable de cambios concretos con su archivo y línea. Esfuerzo: **S** ≤30min, **M** 30min-2h, **L** >2h. Prioridades: **P0** bloqueante para "B2B serio", **P1** alta señal, **P2** pulido.

> Filosofía: cada item debe nombrar un cambio con archivo:línea afectado y métrica de "esto se nota". Nada de "mejorar look & feel".

---

## P0 — bloqueantes para credibilidad B2B

### 1. Eliminar emojis de los feature cards del landing
- **Por qué:** `🎯`, `⚡`, `📊` en `H3` rompen la lectura de software corporativo. Es la primera impresión del producto.
- **Dónde:** `src/app/page.tsx:63, 67, 71` — array de `f.title`.
- **Cómo:** separar `icon` y `title` en el shape del feature; renderizar `<UsersIcon | BoltIcon | ChartBarIcon className="w-8 h-8 text-blue-700 mb-3" />` antes del `<h3>`.
- **Esfuerzo:** S.

### 2. Trust signals con iconos semánticos en lugar de dots verdes
- **Por qué:** los `bg-green-500` dots leen "status indicator" (online/offline), no "promesa de marca". Para un dueño-DAT que acaba de leer "datos en México" eso es un signal débil.
- **Dónde:** `src/app/page.tsx:43-58` y `src/app/precios/page.tsx:132-147`.
- **Cómo:** sustituir por `<TrustSignals items=[{MapPinIcon,...},{LockClosedIcon,...},{CheckCircleIcon,...}]>` (componente ya creado).
- **Esfuerzo:** S.

### 3. CTA secundario "← Hectoria" usa flecha unicode inconsistente
- **Por qué:** `←` y `→` renderean distinto en macOS/Windows/Android (algunos los muestran como emoji a color). En B2B hispanohablante, esto se nota.
- **Dónde:** `src/app/page.tsx:24`, `src/app/precios/page.tsx:102, 108, 336`, `src/app/login/page.tsx:104`, `src/app/dashboard/page.tsx:65`.
- **Cómo:** `<ArrowRightIcon className="w-4 h-4 ml-2" />` (rotate-180 cuando va en "volver").
- **Esfuerzo:** S.

---

## P1 — alta señal de pulido

### 4. Subtítulo del hero no respira: agregar `leading-relaxed`
- **Por qué:** el párrafo de 3 líneas `text-xl text-slate-600` queda apretado por leading default — los ojos saltan, baja el % de gente que lo lee completo.
- **Dónde:** `src/app/page.tsx:15-18`.
- **Cómo:** añadir `leading-relaxed` a la `<p>` del hero (subtítulo).
- **Esfuerzo:** S.

### 5. Plan destacado: el `md:scale-105` desalinea las acciones
- **Por qué:** la card destacada queda 5% más grande, lo que hace que el botón "Empezar" del plan Pro quede ~10px más abajo que los otros dos. Un dueño-DAT comparando precios ve los 3 botones desalineados, lee "incompleto".
- **Dónde:** `src/app/precios/page.tsx:153-157`.
- **Cómo:** quitar `md:scale-105`, mantener `border-2 border-blue-700 shadow-xl` para destacar. Si se quiere "lift", usar `md:-mt-4 md:mb-4` (afecta padding del contenedor, no children).
- **Esfuerzo:** S.

### 6. Trust signals ausentes en `/login`
- **Por qué:** `/login` pide credenciales (email + password o Telegram OAuth). Sin reassurance debajo del form, la conversión cae. Es el peor sitio para no tener trust signals.
- **Dónde:** `src/app/login/page.tsx:191` (después del bloque del form, antes del `</div>` del card).
- **Cómo:** insertar `<TrustSignals items=[{MapPinIcon,"Datos en México"}, {LockClosedIcon,"Cifrado en tránsito"}, {ShieldCheckIcon,"RFC nunca expuesto"}] className="mt-6" />`.
- **Esfuerzo:** S.

### 7. Search input de `/dashboard/clientes` sin icono — affordance pobre
- **Por qué:** un input search sin icono lupa lee como input genérico. Para un usuario que va a buscar entre cientos de RFCs varias veces al día, la fricción acumula.
- **Dónde:** `src/app/dashboard/clientes/page.tsx:122-130`.
- **Cómo:** agregar `MagnifyingGlassIcon` a la lib (Heroicons outline standard) y prefijar el input con `pl-10` + icono absoluto.
- **Esfuerzo:** S.

### 8. Empty state de `/dashboard/clientes` es solo texto
- **Por qué:** "Aún no tienes clientes en cartera..." sin ilustración / icono lee como error o página rota a primera vista. Un empty state es la única primera impresión que verán los usuarios nuevos del dashboard.
- **Dónde:** `src/app/dashboard/clientes/page.tsx:138-141`.
- **Cómo:** envolver el texto con `<UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />` arriba, mantener `<p>` con `text-slate-600`. Considerar agregar CTA secundario "Sincronizar desde portal" si aplica.
- **Esfuerzo:** S.

---

## P2 — pulido y consistencia

### 9. Estandarizar wrappers de sección en `/precios` con `<Section>`
- **Por qué:** la página tiene 5 `<section>` con padding distinto (`pt-16 pb-12`, `py-20`, `py-16`). Provoca rhythm inconsistente — el ojo siente "saltos" al hacer scroll, especialmente entre el bloque de FAQ y la CTA strip.
- **Dónde:** `src/app/precios/page.tsx:114, 130, 222, 271, 324`.
- **Cómo:** reemplazar cada wrapper hand-rolled por `<Section bg="…" spacing="md|sm" width="default|narrow">`. Borrar imports/clases redundantes.
- **Esfuerzo:** M.

### 10. Cards del dashboard ("Mis clientes" / "Cotizar ahora") sin iconografía
- **Por qué:** las 2 cards de `/dashboard` son la nav principal post-login. Solo texto + flecha implícita = no hay diferenciación visual. Iconos arriba aceleran reconocimiento.
- **Dónde:** `src/app/dashboard/page.tsx:73-95`.
- **Cómo:** prefijar el `<h4>` de cada card con `<UsersIcon />` y `<DocumentTextIcon />` respectivamente, `w-6 h-6 text-blue-700 mb-2`. Considerar también agregar `<ArrowRightIcon className="w-4 h-4" />` al final de la card (alineado a la derecha) para reforzar que es clickeable.
- **Esfuerzo:** S.

---

## Bonus — fuera del top 10 pero anotado

- **Footer del landing**: `mt-20` arbitrario, podría sumarse a `<Section as="footer" bg="white" spacing="sm">`. Esfuerzo S.
- **Roadmap fases**: el glyph `›` (línea 259 de `/precios`) podría sustituirse por bullet con dot azul más sutil — el cheurón es leve "windows-y". Esfuerzo S.
- **Modal/banner de error en `/dashboard/clientes:109`**: agregar `<ExclamationTriangleIcon>` antes del texto rojo. Esfuerzo S.
- **Botón "Refrescar"**: prefijar con `<ArrowPathIcon>` para affordance "esto recarga". Esfuerzo S.
- **`<details>` FAQ**: el `+` que rota a `×` es funcional pero `<ChevronDownIcon>` rotando a 180° es la convención web actual. Esfuerzo S.
