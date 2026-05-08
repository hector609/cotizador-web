# Copy — Login (`src/app/login/page.tsx`)

Convención: 3 variantes por bloque salvo donde se indique; **[RECOMENDADA]** marca la propuesta a producción.

---

## 1. Headline + Subheadline

### Variante A — neutro (actual)
**H1:** Iniciar sesión
**H2:** Cotizador Inteligente para DATS

### Variante B — con contexto **[RECOMENDADA]**
**H1:** Entra a tu cotizador.
**H2:** Distribuidores autorizados: usa Telegram para entrar en un toque, o tu email si prefieres.
*Justificación:* el headline es accionable (verbo en imperativo), y el subhead reduce la fricción explicando las dos rutas de login en una sola línea, sin tecnicismos. Calma la duda "¿cómo entro si solo tengo Telegram?".

### Variante C — confianza
**H1:** Bienvenido de vuelta.
**H2:** Tu cartera, tus cotizaciones y tus PDFs te están esperando.
*Justificación:* funciona si la mayoría de logins son recurrentes; menos efectivo si todavía hay muchos primeros logins.

---

## 2. Texto "no tengo cuenta" + CTA solicitar acceso

### Variante A — actual (correcto pero plano)
> ¿Aún no tienes acceso? Solicita una demo en hola@hectoria.mx o por Instagram.

### Variante B — con qué esperar **[RECOMENDADA]**
> ¿Todavía sin cuenta? Pide tu acceso y te respondemos en menos de 24 horas hábiles. Escríbenos a **hola@hectoria.mx** o por DM en **@hectoria.mx**. Si eres distribuidor autorizado del operador líder en México, el alta es inmediata tras validar tu RFC.
*Justificación:* fija expectativa de tiempo de respuesta (24h), explica el filtro de elegibilidad (DAT con RFC), y deja claro que no es un signup self-service. Reduce mensajes tipo "¿siguen activos?" o "¿es real esto?".

### Variante C — corto y directo
> Para solicitar acceso escríbenos a **hola@hectoria.mx** o **@hectoria.mx** en Instagram. Validamos tu RFC de distribuidor y te damos los accesos.

---

## 3. Mensajes de error

Tono: claro sobre qué pasó, qué hacer ahora, sin culpar al usuario.

### a) Credenciales incorrectas (email/password)
- **Mensaje:** "Email o contraseña no coinciden. Revisa que no haya espacios o mayúsculas de más, o entra con Telegram si prefieres."
- *Por qué:* no revelamos si el email existe o no (mejor postura de seguridad), y ofrecemos alternativa concreta.

### b) Login Telegram falló (firma inválida / hash expirado)
- **Mensaje:** "Tu sesión de Telegram expiró antes de poder validarla. Vuelve a tocar el botón de Telegram para intentar de nuevo."
- *Por qué:* explica el motivo real sin tecnicismos ("hash"), y da la acción exacta para resolver.

### c) Cuenta no autorizada / RFC pendiente de validación
- **Mensaje:** "Tu cuenta aún no está activada. Validamos tu RFC en horas hábiles — si han pasado más de 24h, escríbenos a hola@hectoria.mx con el asunto 'alta pendiente'."
- *Por qué:* no deja al usuario en limbo, le da un canal y un asunto que el equipo de soporte ya espera.

### d) Error de red / servidor caído
- **Mensaje:** "No pudimos conectar con el servidor. Revisa tu internet y vuelve a intentar; si sigue, avísanos en @hectoria.mx."
- *Por qué:* primero la causa más probable (conexión del usuario), después la escalada. Evita el típico "Error 500" que no le dice nada al DAT.

### e) [Opcional] Bot de Telegram no carga (script bloqueado)
- **Mensaje:** "El widget de Telegram no cargó. Puede ser un bloqueador de anuncios o tu red corporativa — desactívalo para este sitio o entra con email."
- *Por qué:* común en redes corporativas que bloquean dominios externos; evita ticket de soporte.

---

## 4. Microcopy adicional sugerido

### Debajo del botón "Entrar"
- **Actual:** sin texto.
- **Propuesta [RECOMENDADA]:** "Al entrar aceptas nuestros [Términos](/terminos) y [Privacidad](/privacidad). Sin tracking de terceros."
- *Justificación:* legal limpio + signal de privacidad (anti-tracking) en una sola línea. Solo agregar si las páginas existen.

### Placeholder del campo email
- **Actual:** `tu@distribuidor.mx` (ya bueno, mantener).

### Texto del divider entre Telegram y email
- **Actual:** "o con email" — está bien, mantener.

---

## Resumen de recomendaciones [RECOMENDADAS]

| Bloque | Variante |
|---|---|
| Headline + sub | B (con contexto) |
| Solicitar acceso | B (con expectativa de tiempo) |
| Errores | a, b, c, d (todos) |
| Microcopy términos | Sí, agregar |
