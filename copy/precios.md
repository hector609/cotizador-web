# Copy — Página de Precios (`src/app/precios/page.tsx`)

Convención: 3 variantes por bloque salvo donde se indique; **[RECOMENDADA]** marca la propuesta a producción.

---

## 1. Hero — Headline + Subheadline

### Variante A — emocional fuerte
**H1:** Paga lo que cotizas, no lo que el portal te hace sufrir.
**H2:** Planes mensuales en pesos mexicanos. Sin permanencia, sin letra chica, sin sorpresas en la factura.

### Variante B — outcome cuantificado **[RECOMENDADA]**
**H1:** Recupera 15 horas al mes desde $499.
**H2:** Planes mensuales para distribuidores autorizados. Sin permanencia, cancela cuando quieras. Precios en MXN, sin IVA.
*Justificación:* ancla la decisión a un trade-off concreto: tiempo recuperado vs. precio mínimo. El número (15 h/mes) hace que $499 se sienta barato sin tener que decirlo.

### Variante C — neutro/seguro
**H1:** Un plan para cada momento de tu operación.
**H2:** Desde el solo-distribuidor hasta el equipo de 20 vendedores. Cambia de plan cuando crezcas, cancela cuando quieras.

---

## 2. Taglines por plan (debajo del nombre del plan)

### Plan Starter — $499 MXN/mes
- A: Para el solo-distribuidor que cotiza a diario.
- B: **Para el que vende solo y quiere recuperar la mañana.** **[RECOMENDADA]**
- C: Para empezar sin compromiso.

### Plan Pro — $1,299 MXN/mes
- A: Para equipos en crecimiento.
- B: **Para el equipo de 2 a 5 vendedores que ya no cabe en una hoja de Excel.** **[RECOMENDADA]**
- C: El plan más completo para PyMEs.

### Plan Business — $2,999 MXN/mes
- A: Para operaciones serias.
- B: **Para la operación que ya no puede permitirse cuellos de botella.** **[RECOMENDADA]**
- C: Para distribuidores con volumen alto.

*Justificación general:* las variantes B describen al cliente con precisión (no por tamaño abstracto sino por su realidad operativa). El DAT se autoselecciona leyendo: "ese soy yo".

---

## 3. Etiqueta "Más popular" — alternativas

- A: **Más popular** *(actual, genérico)*
- B: **Recomendado** **[RECOMENDADA]**
- C: Elegido por 8 de cada 10

*Justificación de B:* "Recomendado" es honesto cuando aún no tienes base instalada que respalde el "8 de cada 10". Suena curado por un experto, no inflado por marketing. La opción C se reserva para cuando tengamos data real (>50 cuentas) — usarla antes es riesgoso si un cliente pregunta por la fuente.

---

## 4. Texto de reaseguro debajo del grid de planes

### Variante A — funcional
> Activación en 24 horas hábiles. Te damos los accesos en cuanto validamos tu RFC de distribuidor.

### Variante B **[RECOMENDADA]**
> Activación en 24 horas. Sin tarjeta para empezar la prueba — primero el bot funciona en tu operación, después hablamos de cobro.
*Justificación:* "sin tarjeta para empezar" es la fricción #1 de signup en SaaS. El segundo verbo ("hablamos de cobro") humaniza y deja claro que el flujo no es self-service de Stripe (cosa que aún no tienes), sin sonar artesanal.

### Variante C — garantía
> Si en los primeros 14 días no ahorras al menos 5 horas a la semana, te devolvemos el primer mes. Sin preguntas.

*Nota:* la variante C solo es viable si Hectoria está dispuesta a operar el reembolso. Si no, NO usarla — promesas incumplibles destruyen confianza.

---

## 5. Microcopy adicional sugerido

### Debajo del precio, en cada card
> Facturación CFDI disponible en planes Pro y Business.

### Junto al CTA "Empezar"
- Starter: **Empezar prueba** (en lugar de "Empezar")
- Pro: **Probar Pro 14 días** (con badge de prueba)
- Business: **Hablar con ventas** (no "Empezar" — implica negociación)

*Justificación:* el CTA debe reflejar el momento de compra real. Business no se compra en 1 clic, hay que aceptarlo en el copy.
