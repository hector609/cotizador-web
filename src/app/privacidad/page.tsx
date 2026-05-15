import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de Privacidad · Cotizador",
  description: "Aviso de privacidad del Cotizador Telcel para distribuidores.",
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <article className="prose prose-slate mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight">Aviso de Privacidad</h1>
        <p className="text-sm text-slate-500">Última actualización: 14 de mayo de 2026</p>

        <h2>Responsable</h2>
        <p>Hectoria SaaS (en adelante &quot;el Responsable&quot;) es responsable del tratamiento de sus datos personales.</p>

        <h2>Datos que recabamos</h2>
        <ul>
          <li>Identificación: nombre, correo, teléfono, RFC del distribuidor.</li>
          <li>Operación: cotizaciones generadas, clientes consultados, métricas de uso.</li>
          <li>Credenciales del portal Telcel (cifradas, nunca expuestas).</li>
          <li>Datos técnicos: IP, agente de usuario, eventos de la sesión.</li>
        </ul>

        <h2>Finalidades</h2>
        <ul>
          <li>Prestar el Servicio de cotización.</li>
          <li>Soporte, mantenimiento y mejora del producto.</li>
          <li>Facturación y cumplimiento legal.</li>
          <li>Notificaciones operativas (no marketing salvo consentimiento explícito).</li>
        </ul>

        <h2>Encargados (terceros)</h2>
        <p>Compartimos datos estrictamente necesarios con:</p>
        <ul>
          <li>Vercel Inc. — hosting de la aplicación web.</li>
          <li>Fly.io — hosting del bot y API.</li>
          <li>Anthropic PBC — procesamiento de lenguaje natural (Aria).</li>
          <li>ElevenLabs Inc. — síntesis de voz (opcional).</li>
          <li>Stripe Inc. — procesamiento de pagos (ver sección específica abajo).</li>
          <li>Telcel — portal de cotización (usted ejecuta esta integración con sus propias credenciales).</li>
        </ul>

        <h2>Datos compartidos con Stripe</h2>
        <p>
          Para procesar pagos de suscripciones, compartimos datos de pago únicamente con Stripe Inc., procesador de
          pagos certificado PCI-DSS Level 1:
        </p>
        <ul>
          <li>Nombre del titular de la tarjeta de crédito o débito.</li>
          <li>
            Número de tarjeta (procesado mediante tokenización en tiempo real; Cotizador no almacena el PAN completo).
          </li>
          <li>Código de seguridad (CVC).</li>
          <li>Dirección de facturación.</li>
          <li>Correo electrónico del titular del pago.</li>
        </ul>
        <p>
          Estos datos viajan directamente desde su navegador a los servidores de Stripe en Estados Unidos, bajo
          encriptación TLS 1.3. Cotizador nunca recibe ni almacena el número completo de la tarjeta; solo guardamos:
        </p>
        <ul>
          <li>
            <strong>stripe_customer_id</strong>: ID opaco del cliente en Stripe (no identifica la tarjeta específica).
          </li>
          <li>
            <strong>Email del titular</strong>: para enviar recibos de pago (invoices).
          </li>
          <li>
            <strong>Plan activo</strong>: nivel de suscripción vigente.
          </li>
          <li>
            <strong>Últimos 4 dígitos</strong>: mostrados únicamente en{" "}
            <Link href="/dashboard/billing" className="text-cyan-700 hover:underline">
              /dashboard/billing
            </Link>
            {" "}para su referencia.
          </li>
        </ul>
        <p>
          Para conocer cómo Stripe trata sus datos, consulte su{" "}
          <a
            href="https://stripe.com/mx/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-700 hover:underline"
          >
            Política de Privacidad
          </a>
          .
        </p>

        <h2>Derechos ARCO</h2>
        <p>
          Conforme a la Ley Federal de Protección de Datos Personales en Posesión de Particulares (LFPDPPP), usted puede
          ejercer sus derechos de Acceso, Rectificación, Cancelación u Oposición escribiendo a{" "}
          <a href="mailto:privacidad@hectoria.mx" className="text-cyan-700 hover:underline">
            privacidad@hectoria.mx
          </a>
          . Atenderemos su solicitud en máximo 20 días hábiles.
        </p>

        <h2>Transferencias internacionales</h2>
        <p>
          Algunos encargados (Anthropic, ElevenLabs, Vercel) procesan datos en Estados Unidos. Se aplican las
          salvaguardas estándar contractuales.
        </p>

        <h2>Retención</h2>
        <p>
          Conservamos sus datos mientras la cuenta esté activa más 24 meses para fines fiscales y de auditoría.
          Después se eliminan o anonimizan.
        </p>

        <h2>Cambios al aviso</h2>
        <p>
          Notificaremos cambios al correo registrado y aquí mismo. El uso continuado tras la notificación implica
          aceptación.
        </p>

        <hr className="my-12" />
        <p className="text-sm text-slate-500">
          <Link href="/" className="text-cyan-700 hover:underline">
            ← Volver al inicio
          </Link>
        </p>
      </article>
    </main>
  );
}
