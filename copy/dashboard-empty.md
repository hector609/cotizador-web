# Copy — Dashboard estado vacío post-login (`src/app/dashboard/page.tsx`)

Contexto: el usuario acaba de iniciar sesión y aterriza en el dashboard. **El producto vive en Telegram**, no en la web. El dashboard es panel de control y entrada al bot, no donde se cotiza. Este copy resuelve la confusión de "¿y ahora qué hago aquí?".

Convención: 3 variantes por bloque; **[RECOMENDADA]** marca la propuesta a producción.

---

## 1. Headline (saludo de bienvenida)

### Variante A — actual
**H1 (sección):** Bienvenido
**Subline:** Tu cotizador vive donde tú trabajas.

### Variante B **[RECOMENDADA]**
**H1 (sección):** Listo. Tu cotizador está activo.
**Subline:** Las cotizaciones se generan en Telegram. Este panel es para que veas tu cartera, métricas y configuración.
*Justificación:* "Listo. Tu cotizador está activo." confirma que el login funcionó (cierra el loop emocional del paso anterior) y aclara de inmediato la división de tareas web/Telegram. Evita la pregunta tácita "¿no se cotiza aquí?".

### Variante C — más cálida
**H1:** Hola de nuevo, [Nombre].
**Subline:** Todo listo para cotizar. Pasa al bot cuando quieras empezar.

*Nota:* C requiere tener el nombre del usuario disponible en sesión.

---

## 2. Bloque hero "Tu cotización vive en Telegram"

### Headline del card

#### Variante A — actual
> Tu cotización vive en Telegram

#### Variante B **[RECOMENDADA]**
> Cotiza desde Telegram, controla desde aquí.
*Justificación:* introduce la dualidad web ↔ bot en una frase, en lugar de solo decir "ve a Telegram". Refuerza que el dashboard tiene valor propio (controlar) y no es solo un redirect.

#### Variante C
> El bot está listo. Solo abre Telegram.

---

### Párrafos de soporte (2 párrafos cortos debajo del headline)

#### Variante A — actual (1 párrafo, expandirlo)
> Cotiza, busca expedientes y descarga PDFs oficiales desde el chat que ya usas a diario. Sin instalar nada, sin cambiar de pestaña.

#### Variante B **[RECOMENDADA]** — 2 párrafos cortos
> **Párrafo 1:** Cotiza, busca expedientes y descarga PDFs oficiales sin abrir el portal del operador. Todo desde el chat de Telegram que ya usas a diario.
>
> **Párrafo 2:** Cuando termines una cotización, vuelve aquí: en este panel ves tu cartera de clientes, métricas de uso del mes y el historial de PDFs generados por tu equipo.
*Justificación:* explícitamente narra el flujo de ida y vuelta (cotizar en TG → revisar en web). Le da al usuario un mapa mental de cuándo usa cada superficie, lo que reduce churn temprano por confusión.

#### Variante C — más motivacional
> Cotiza desde el lugar donde ya pasas el día. El bot reemplaza al portal del operador y te ahorra abrir 12 ventanas para una sola cotización.
> Vuelve a este panel cuando quieras ver el resumen del mes o descargar PDFs viejos.

---

## 3. CTA primario "Abrir bot en Telegram"

### Variantes
- A: **Abrir bot →** *(actual, correcto)*
- B: **Abrir bot en Telegram →** **[RECOMENDADA]**
- C: **Empezar a cotizar →**

*Justificación de B:* explicita el destino. El usuario novato en su primer login puede no asumir que "Abrir bot" lo manda a Telegram (puede esperar un modal, una nueva pestaña web, etc.). Decir "en Telegram" elimina la sorpresa y suma confianza.

*Justificación de C (alternativa):* más orientada al verbo del oficio. Buena si el botón está acompañado de un ícono de Telegram visible que ya transmite el destino.

---

## 4. Microcopy debajo del CTA

### Variante A — actual
> ¿Aún no estás dado de alta? Pide tu acceso a tu administrador.

### Variante B **[RECOMENDADA]**
> ¿Es tu primera vez en el bot? Empieza con `/start` y el menú te guía. Si algo no jala, escríbenos a **@hectoria.mx**.
*Justificación:* el copy actual ("pide tu acceso a tu administrador") asume que el usuario es vendedor en una organización con admin — pero la mayoría de logins iniciales son del propio dueño-DAT, no de un subordinado. La variante B sirve mejor al caso real: explica el primer comando y da una salida si se atora.

### Variante C — split por contexto
- Si el usuario tiene rol "owner": "¿Primera vez? Escribe `/start` en el bot y te lleva al menú principal."
- Si tiene rol "vendedor": "¿No te aparece el menú? Pide a tu administrador que te dé de alta como vendedor."

*Nota:* C requiere conocer el rol del usuario en sesión.

---

## 5. Cards inferiores ("Mis clientes" y "Cotizar ahora")

### Card "Mis clientes" — descripción

#### Variante A — actual
> Consulta tu cartera de RFCs sincronizada desde el portal del operador autorizado.

#### Variante B **[RECOMENDADA]**
> Tu cartera de clientes corporativos sincronizada con el portal del operador. Busca por RFC, razón social o expediente.
*Justificación:* añade los criterios de búsqueda concretos — el DAT entiende inmediatamente para qué le sirve esa pantalla.

### Card "Cotizar ahora" — descripción

#### Variante A — actual
> Abre el bot en Telegram y empieza una cotización en menos de un minuto.

#### Variante B **[RECOMENDADA]**
> Abre el bot y arranca una cotización. El primer plan listo para enviar al cliente toma 2 minutos.
*Justificación:* "menos de un minuto" suena exagerado y daña credibilidad si el usuario tarda 90 segundos. "2 minutos" es honesto, sigue siendo dramáticamente mejor que los 20 minutos del portal, y es coherente con el headline del landing.

---

## Resumen de recomendaciones [RECOMENDADAS]

| Bloque | Variante |
|---|---|
| Headline bienvenida | B ("Listo. Tu cotizador está activo.") |
| Headline card hero | B ("Cotiza desde Telegram, controla desde aquí.") |
| Párrafos card hero | B (2 párrafos, narran ida y vuelta) |
| CTA primario | B ("Abrir bot en Telegram →") |
| Microcopy debajo CTA | B ("Empieza con /start...") |
| Card clientes | B (incluye criterios de búsqueda) |
| Card cotizar | B ("2 minutos" en lugar de "menos de un minuto") |
