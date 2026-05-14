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
          <li>Telcel — portal de cotización (usted ejecuta esta integración con sus propias credenciales).</li>
        </ul>

        <h2>Derechos ARCO</h2>
        <p>
          Usted puede ejercer sus derechos de Acceso, Rectificación, Cancelación u Oposición escribiendo a{" "}
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
