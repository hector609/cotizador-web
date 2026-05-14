import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio · Cotizador",
  description: "Términos de servicio del Cotizador Telcel para distribuidores.",
};

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <article className="prose prose-slate mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight">Términos de Servicio</h1>
        <p className="text-sm text-slate-500">Última actualización: 14 de mayo de 2026</p>

        <h2>1. Aceptación</h2>
        <p>
          Al registrarse o usar el Cotizador (operado por Hectoria SaaS, en adelante &quot;el Servicio&quot;) usted acepta
          estos términos. Si no está de acuerdo, no use el Servicio.
        </p>

        <h2>2. Uso autorizado</h2>
        <p>
          El Servicio está dirigido a distribuidores autorizados de Telcel Empresas. Usted se compromete a usar el
          Servicio únicamente para fines lícitos relacionados con su actividad comercial de cotización y venta.
        </p>

        <h2>3. Cuenta y credenciales</h2>
        <p>
          Usted es responsable de mantener la confidencialidad de sus credenciales y de todas las acciones realizadas
          desde su cuenta. Notifique inmediatamente a soporte si detecta uso no autorizado.
        </p>

        <h2>4. Datos personales</h2>
        <p>
          Tratamos sus datos conforme a nuestro{" "}
          <Link href="/privacidad" className="text-cyan-700 hover:underline">
            Aviso de Privacidad
          </Link>
          . Al usar el Servicio autoriza el tratamiento descrito ahí.
        </p>

        <h2>5. Información de Telcel</h2>
        <p>
          El Servicio integra con el portal de Telcel para generar cotizaciones. Las credenciales del portal son
          provistas por usted y se almacenan cifradas. El Servicio no es operado, patrocinado ni avalado por Telcel.
        </p>

        <h2>6. Limitación de responsabilidad</h2>
        <p>
          El Servicio se proporciona &quot;tal cual&quot;. No garantizamos disponibilidad ininterrumpida del portal
          Telcel ni la exactitud de los precios devueltos por sus sistemas. La responsabilidad máxima del Servicio se
          limita al monto pagado en los últimos 3 meses.
        </p>

        <h2>7. Suspensión y terminación</h2>
        <p>
          Podemos suspender o terminar su acceso si detectamos uso indebido, fraude, o impago. Usted puede cancelar su
          cuenta en cualquier momento desde Configuración.
        </p>

        <h2>8. Cambios a estos términos</h2>
        <p>
          Notificaremos cambios materiales con 15 días de anticipación al correo registrado. El uso continuado tras la
          notificación implica aceptación.
        </p>

        <h2>9. Contacto</h2>
        <p>
          Dudas legales:{" "}
          <a href="mailto:legal@hectoria.mx" className="text-cyan-700 hover:underline">
            legal@hectoria.mx
          </a>
          .
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
