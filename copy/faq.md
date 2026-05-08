# Copy — Preguntas frecuentes (FAQ)

8 preguntas más probables del DAT (dueño/gerente comercial de distribuidor autorizado). Tono: honesto, directo, sin marketing-hype. Respuestas de 2-4 oraciones, sin promesas que no podamos sostener.

Ubicación sugerida: sección FAQ en `src/app/precios/page.tsx` (ampliar las 4 actuales) y/o nueva `src/app/faq/page.tsx`.

---

## 1. ¿Cómo funciona el pago?

Suscripción mensual en pesos mexicanos, sin compromiso de permanencia. Los primeros días son sin tarjeta: validamos tu RFC de distribuidor, te damos accesos y empiezas a cotizar; el cobro arranca al activar el plan. Cancelas cuando quieras desde tu cuenta y conservas el servicio hasta el fin del periodo pagado. Facturación CFDI disponible en Pro y Business.

## 2. ¿Qué pasa si excedo las cotizaciones del plan?

Te avisamos al llegar al 80% del límite y otra vez al 100%, siempre con la opción de hacer upgrade en un clic. Si te pasaste un mes puntual no te cortamos el bot a media cotización: te dejamos terminar las que tienes en curso y al cierre del ciclo decides si subes de plan o sigues igual. Nunca cobramos overages sorpresa.

## 3. ¿Mis datos están seguros?

Sí. Servidores en México, cifrado en tránsito (HTTPS/TLS) en todo el flujo, y aislamiento por tenant: cada distribuidor solo ve sus propias credenciales y cartera. Tu RFC y los de tus clientes nunca se exponen en logs públicos ni se comparten con terceros — los datos sensibles van enmascarados en las trazas. No vendemos ni cruzamos información entre cuentas.

## 4. ¿Necesito instalar algo?

No. El bot vive en Telegram (que probablemente ya tienes) y el dashboard corre en cualquier navegador moderno. No hay APK que instalar, ni extensión de Chrome, ni VPN, ni cliente de escritorio. Si tu equipo usa celulares Android o iPhone, ya tienen todo lo que necesitan.

## 5. ¿Funciona si tengo varios vendedores?

Sí, y de hecho ahí es donde más se nota la diferencia. Cada vendedor entra con su propio acceso y cotiza en paralelo sin pisarse con los demás; los datos quedan aislados por usuario y como dueño ves todo en un dashboard consolidado. El plan Pro incluye hasta 5 vendedores, Business no tiene tope. Si necesitas controlar permisos finos por vendedor, eso llega en la Fase 2 del roadmap.

## 6. ¿Puedo cancelar?

Cuando quieras y sin llamar a nadie. Cancelas desde tu cuenta o respondiendo un email — el servicio sigue activo hasta el último día del ciclo que ya pagaste y después se desactiva, sin cargos extras ni "letras chicas". Si más adelante regresas, tu cartera de clientes y configuraciones siguen ahí 90 días por si te arrepientes.

## 7. ¿Qué pasa si el operador cambia los planes o el portal?

Es parte del trabajo y por eso existimos: cuando el operador líder mueve algo (precios, palancas, formato de PDF, layout del portal), nosotros actualizamos el bot del lado del servidor — tú no haces nada. La mayoría de cambios los absorbemos en horas; los grandes (rediseño de portal) en días. Si algún día el operador cierra el acceso de distribuidores externos, te avisamos con tiempo y te devolvemos el último mes pagado.

## 8. ¿Hay soporte en español?

Sí, soporte humano en español de México y en horario laboral CDMX (lun-vie 9-19h). Starter por email con respuesta en 24h hábiles; Pro con prioridad y respuesta el mismo día; Business con WhatsApp directo y onboarding 1-a-1. No tercerizamos soporte: te contesta alguien del equipo de Hectoria que conoce el producto.

---

## Notas de implementación

- **Orden recomendado en la página:** 1, 2, 4, 3, 5, 6, 8, 7. Las objeciones de seguridad (3) van más arriba si el segmento es enterprise; abajo si es solo-distribuidor.
- **Formato:** mantener `<details>/<summary>` colapsable como ya está en `precios/page.tsx`.
- **No cambiar:** las respuestas que mencionan números (24h hábiles, 80%, 90 días) deben coincidir con la realidad operativa de Hectoria — si no son exactos, ajustar antes de publicar.
