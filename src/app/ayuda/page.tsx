"use client";

/**
 * /ayuda — Centro de Ayuda
 * LUMINA Light Premium design system.
 * Client component: search filter + framer-motion accordion.
 */

import { useState, useId, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  BoltIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  CreditCardIcon,
  QuestionMarkCircleIcon,
  LinkIcon,
  ChatBubbleLeftRightIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
} from "@/components/icons";

/* ──────────────────────────────────────────────────────────────────────── */
/* Data                                                                     */
/* ──────────────────────────────────────────────────────────────────────── */

interface FaqItem {
  q: string;
  a: string;
}

interface Section {
  id: string;
  titulo: string;
  IconComponent: React.ComponentType<{ className?: string }>;
  items: FaqItem[];
}

const SECTIONS: Section[] = [
  {
    id: "pagos",
    titulo: "Pagos y suscripciones",
    IconComponent: CreditCardIcon,
    items: [
      {
        q: "¿Qué métodos de pago aceptan?",
        a: "Aceptamos Visa, Mastercard y American Express. El cobro se procesa de forma segura a través de Stripe. OXXO estará disponible próximamente — si lo necesitas, contáctanos en hector@hectoria.mx y buscamos una alternativa.",
      },
      {
        q: "¿Cómo cancelo mi suscripción?",
        a: 'Entra a tu cuenta y ve a /dashboard/billing. Ahí encontrarás el botón "Cancelar suscripción". El servicio permanece activo hasta el último día del periodo ya pagado — no hay cargos adicionales ni trámites telefónicos.',
      },
      {
        q: "¿Hay reembolso si cancelo?",
        a: "No emitimos reembolsos parciales por los días no utilizados dentro de un ciclo ya cobrado. Si cancelas antes de que termine tu prueba gratuita, no se realizará ningún cargo. En casos excepcionales por fallo técnico de nuestra parte, evaluamos reembolsos caso por caso — escríbenos a hector@hectoria.mx.",
      },
      {
        q: "¿Cuándo se renueva mi suscripción?",
        a: "Tu suscripción se renueva automáticamente el mismo día de cada mes en que la activaste. Recibirás un correo de confirmación de Stripe con el comprobante de pago 24 horas antes y al momento del cargo.",
      },
      {
        q: "¿Puedo cambiar de plan?",
        a: "Sí. Desde /dashboard/billing puedes hacer upgrade o downgrade en cualquier momento. El cambio aplica de forma inmediata; si subes de plan, el costo se prorratea al día. Si bajas, el nuevo precio entra al inicio del siguiente ciclo.",
      },
      {
        q: "¿Cómo solicito factura CFDI?",
        a: "La facturación CFDI está disponible en los planes Pro y Empresa. Escríbenos a hector@hectoria.mx con tu RFC, razón social, uso de CFDI y el mes a facturar. Emitimos la factura en un plazo máximo de 3 días hábiles.",
      },
      {
        q: "¿Es seguro pagar con tarjeta?",
        a: "Sí. Los pagos se procesan a través de Stripe, que cumple con el estándar PCI-DSS Nivel 1 — el más alto de la industria. Tu número de tarjeta nunca llega a nuestros servidores; Stripe lo cifra con TLS 1.3 y lo almacena con encriptación de 256 bits. Nosotros solo guardamos un token de referencia.",
      },
    ],
  },
  {
    id: "cotizaciones",
    titulo: "Cotizaciones",
    IconComponent: BoltIcon,
    items: [
      {
        q: "¿Cómo cotizo un equipo?",
        a: 'Tienes dos formas: (1) Desde la web en /dashboard, abre el chat con Aria AI y descríbele lo que necesitas — nombre del cliente, equipo, plazo y modalidad. (2) Desde Telegram enviando el comando /cotizar al bot. En ambos casos el sistema ingresa al portal Telcel Empresas con tus credenciales y regresa el PDF oficial en minutos.',
      },
      {
        q: "¿Qué pasa si el portal Telcel está caído?",
        a: "El bot detecta automáticamente si el portal no responde y te notifica con un mensaje claro. La cotización queda en pausa — no se pierde — y puedes reintentar cuando el portal vuelva. También puedes escribirnos a hector@hectoria.mx si el problema persiste más de 1 hora.",
      },
      {
        q: "¿Cómo descargo el PDF?",
        a: "Una vez que la cotización termina, aparece el botón de descarga directo en el chat web o en Telegram. En la web también puedes ir a /dashboard y encontrar el PDF en el historial de cotizaciones de ese cliente.",
      },
      {
        q: "¿Por qué tarda 5-10 minutos una cotización?",
        a: "El bot navega el portal Telcel Empresas en tiempo real — igual que lo harías tú manualmente, pero sin errores y en paralelo para todos tus vendedores. El portal mismo tiene tiempos de respuesta variables dependiendo del tráfico. La mayor parte de cotizaciones sale en 3-7 minutos.",
      },
      {
        q: "¿Puedo cotizar multi-perfil?",
        a: "Sí, los planes Pro y Empresa incluyen cotizaciones multi-perfil: puedes comparar hasta 3 perfiles de cliente (e.g., control, prepago, libre) dentro de una misma sesión. Indica los perfiles en el chat y Aria los cotiza en secuencia.",
      },
      {
        q: "¿Cómo aplico palancas comerciales?",
        a: "Dile a Aria en el chat qué palancas quieres aplicar (por ejemplo, descuento por volumen o financiamiento especial). El bot las aplica durante la cotización en el portal. Las palancas disponibles dependen de tu perfil de distribuidor con Telcel Empresas.",
      },
    ],
  },
  {
    id: "cuenta",
    titulo: "Cuenta y onboarding",
    IconComponent: UserCircleIcon,
    items: [
      {
        q: "¿Cómo me registro?",
        a: 'Ve a /signup, ingresa tu correo y crea una contraseña. Después completa el proceso en /onboarding: validamos tu RFC de distribuidor, conectas tus credenciales Telcel Empresas y subes tu cartera de clientes. Todo el flujo toma aproximadamente 15 minutos la primera vez.',
      },
      {
        q: "Olvidé mi contraseña",
        a: 'En la pantalla de /login haz clic en "¿Olvidaste tu contraseña?" e ingresa tu correo. Recibirás un enlace de restablecimiento válido por 24 horas. Si no ves el correo, revisa la carpeta de spam o escríbenos a hector@hectoria.mx.',
      },
      {
        q: "¿Cómo conecto mis credenciales Telcel?",
        a: "Durante el /onboarding hay un paso dedicado a esto. Ingresas tu usuario y contraseña del portal Telcel Empresas — los mismos que usas al entrar manualmente. Estos datos se almacenan cifrados y se utilizan exclusivamente para cotizar en tu nombre.",
      },
      {
        q: "¿Cómo subo mi cartera de clientes?",
        a: "En el paso de cartera dentro de /onboarding puedes subir un archivo Excel (.xlsx) con tus clientes. El formato mínimo requiere columnas RFC y Nombre. También puedes agregar clientes uno a uno desde /dashboard/clientes en cualquier momento.",
      },
      {
        q: "¿Cómo agrego vendedores a mi cuenta?",
        a: "Para agregar vendedores a tu equipo, contacta a soporte en hector@hectoria.mx con los detalles del vendedor (nombre y correo). Cada vendedor recibe un acceso independiente bajo tu misma cuenta de distribuidor. El número de vendedores incluidos depende de tu plan (Starter: hasta 3, Pro: hasta 10, Empresa: ilimitados).",
      },
    ],
  },
  {
    id: "link-publico",
    titulo: "Link público (G-1)",
    IconComponent: LinkIcon,
    items: [
      {
        q: "¿Qué es un link público de captura?",
        a: "Es una URL personalizada que genera el sistema para que tus clientes ingresen su información de forma autónoma — nombre, RFC, equipo de interés — sin que tú necesites estar en línea. Sus datos llegan directo a tu dashboard para que puedas cotizar después.",
      },
      {
        q: "¿Cómo genero un link para mi cliente?",
        a: "En el chat de Aria o en /dashboard, solicita un link público. El sistema genera una URL única del tipo cotizador.hectoria.mx/p/[código]. Puedes compartirla por WhatsApp, correo o cualquier canal.",
      },
      {
        q: "¿Mi cliente necesita cuenta?",
        a: "No. El link público es accesible sin registro. Tu cliente solo llena un formulario breve con su información y tú recibes los datos en tu dashboard para continuar el proceso.",
      },
      {
        q: "¿Cuánto dura activo un link?",
        a: "Los links públicos están activos por 30 días desde su creación. Si necesitas extender el plazo o generar uno nuevo para el mismo cliente, puedes hacerlo desde /dashboard sin costo adicional.",
      },
    ],
  },
  {
    id: "telegram",
    titulo: "Bot Telegram",
    IconComponent: ChatBubbleLeftRightIcon,
    items: [
      {
        q: "¿Cómo conecto Telegram?",
        a: "Durante el /onboarding encontrarás el paso de conexión Telegram. Haz clic en el botón que abre la conversación con el bot en Telegram y envía el comando /start. El sistema vincula tu cuenta automáticamente.",
      },
      {
        q: "¿Qué comandos hay?",
        a: "/cotizar — inicia una cotización. /historial — ve tus últimas cotizaciones. /clientes — busca un cliente en tu cartera. /calibrar — ajusta parámetros de cotización. /planes — catálogo de planes disponibles. /ayuda — muestra los comandos disponibles. Para ver la lista completa, envía /start al bot.",
      },
      {
        q: "El bot no me responde",
        a: "Primero verifica que estás usando el bot correcto (el enlace te lo damos en el onboarding). Si el bot no responde en 2 minutos, prueba enviando /start para reiniciar la sesión. Si el problema persiste, escríbenos a hector@hectoria.mx con tu nombre y el mensaje que intentabas enviar.",
      },
      {
        q: "¿Cómo agrego otros vendedores al bot?",
        a: "Para agregar vendedores que tengan acceso al bot, contacta a soporte en hector@hectoria.mx con los detalles del vendedor. Cada vendedor recibe credenciales de acceso independientes y conecta su propio Telegram. Así cada uno cotiza con su propio acceso pero bajo la misma cuenta de distribuidor.",
      },
    ],
  },
  {
    id: "soporte",
    titulo: "Soporte técnico",
    IconComponent: WrenchScrewdriverIcon,
    items: [
      {
        q: "¿Cómo contacto a soporte humano?",
        a: "Escríbenos directamente a hector@hectoria.mx. Respondemos en menos de 24 horas hábiles (Lun-Vie, 9am-7pm CDMX). Los planes Pro y Empresa tienen prioridad de respuesta.",
      },
      {
        q: "¿Cuál es el horario de soporte?",
        a: "Lunes a viernes de 9:00 am a 7:00 pm hora Ciudad de México. Fuera de ese horario puedes escribir y te respondemos en cuanto regresemos. Para incidentes críticos en Empresa, el SLA es de 4 horas en días hábiles.",
      },
      {
        q: "¿Cuál es el SLA de respuesta?",
        a: "Starter: respuesta en menos de 24 horas hábiles por correo. Pro: respuesta el mismo día hábil. Empresa: 4 horas hábiles con WhatsApp directo. Todos los planes tienen acceso a nuestro historial de incidentes si ocurre una interrupción del servicio.",
      },
      {
        q: "¿Cómo reporto un bug?",
        a: "Envía un correo a hector@hectoria.mx con: (1) descripción de lo que intentabas hacer, (2) qué pasó vs. qué esperabas, (3) capturas de pantalla o el mensaje de error exacto, y (4) la hora aproximada del incidente. Con esa información podemos reproducir y resolver el problema mucho más rápido.",
      },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────────────── */
/* Motion variants                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const accordionContent: Variants = {
  collapsed: { height: 0, opacity: 0 },
  open: {
    height: "auto",
    opacity: 1,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ──────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

function TopNav() {
  return (
    <motion.nav
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/60 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-black tracking-tight"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 via-cyan-500 to-pink-500 text-white shadow-[0_0_18px_rgba(79,70,229,0.35)]">
            <BoltIcon className="w-4 h-4" />
          </span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-500">
            Lumina
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link
            href="/precios"
            className="text-slate-600 hover:text-indigo-600 transition-colors"
          >
            Precios
          </Link>
          <Link
            href="/ayuda"
            className="text-indigo-600 font-semibold"
          >
            Ayuda
          </Link>
          <Link
            href="/login"
            className="text-slate-600 hover:text-indigo-600 transition-colors"
          >
            Login
          </Link>
        </div>
        <Link
          href="/signup"
          className="group relative inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold shadow-[0_8px_24px_-6px_rgba(79,70,229,0.5)] hover:shadow-[0_10px_30px_-4px_rgba(6,182,212,0.55)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
        >
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <span className="relative">Probar gratis</span>
        </Link>
      </div>
    </motion.nav>
  );
}

function HeroSection({
  query,
  onChange,
}: {
  query: string;
  onChange: (v: string) => void;
}) {
  return (
    <section className="relative pt-32 pb-16 px-6 overflow-hidden bg-white">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[440px] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 65% 55% at 50% 0%, rgba(79,70,229,0.09) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 80% 25%, rgba(6,182,212,0.09) 0%, transparent 55%),
            radial-gradient(ellipse 40% 40% at 15% 25%, rgba(236,72,153,0.07) 0%, transparent 55%)
          `,
        }}
      />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="relative z-10 max-w-2xl mx-auto text-center space-y-6"
      >
        <motion.div variants={fadeUp}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold uppercase tracking-wider shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            Centro de Ayuda
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.08] text-slate-900"
        >
          Como podemos ayudarte
        </motion.h1>

        <motion.p variants={fadeUp} className="text-lg text-slate-600 leading-relaxed">
          Encuentra respuestas sobre pagos, cotizaciones, tu cuenta y el bot de Telegram.
        </motion.p>

        {/* Search */}
        <motion.div variants={fadeUp} className="pt-2">
          <div className="relative max-w-xl mx-auto">
            <MagnifyingGlassIcon
              className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              placeholder="Busca tu pregunta..."
              value={query}
              onChange={(e) => onChange(e.target.value)}
              className="w-full pl-12 pr-5 py-4 rounded-full border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 text-base shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function AccordionItem({ item, defaultOpen = false }: { item: FaqItem; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        open
          ? "border-indigo-200 bg-white shadow-md shadow-indigo-100/40"
          : "border-slate-200 bg-white hover:border-indigo-200"
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`faq-${id}`}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 group"
      >
        <span className="font-semibold text-slate-900 tracking-tight text-sm leading-snug">
          {item.q}
        </span>
        <span
          className={`flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-200 ${
            open
              ? "border-indigo-300 bg-indigo-50 text-indigo-600"
              : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-indigo-200 group-hover:text-indigo-500"
          }`}
          aria-hidden="true"
        >
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="minus"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.18 }}
              >
                <MinusIcon className="w-4 h-4" />
              </motion.span>
            ) : (
              <motion.span
                key="plus"
                initial={{ opacity: 0, rotate: 90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -90 }}
                transition={{ duration: 0.18 }}
              >
                <PlusIcon className="w-4 h-4" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`faq-${id}`}
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={accordionContent}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-slate-600 text-sm leading-relaxed">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionBlock({
  section,
  query,
}: {
  section: Section;
  query: string;
}) {
  const lower = query.toLowerCase().trim();

  const filtered = lower
    ? section.items.filter(
        (item) =>
          item.q.toLowerCase().includes(lower) ||
          item.a.toLowerCase().includes(lower)
      )
    : section.items;

  if (filtered.length === 0) return null;

  const { IconComponent } = section;

  return (
    <motion.section
      id={section.id}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.05 }}
      variants={stagger}
      className="scroll-mt-24"
    >
      <motion.div variants={fadeUp} className="flex items-center gap-3 mb-5">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-[0_6px_18px_-4px_rgba(79,70,229,0.4)]">
          <IconComponent className="w-4 h-4" />
        </span>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {section.titulo}
        </h2>
      </motion.div>

      <motion.div variants={stagger} className="space-y-2.5">
        {filtered.map((item) => (
          <motion.div key={item.q} variants={fadeUp}>
            <AccordionItem item={item} />
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}

function Sidebar({ sections }: { sections: Section[] }) {
  return (
    <nav aria-label="Secciones de ayuda" className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-2">
        Secciones
      </p>
      {sections.map((s) => {
        const { IconComponent } = s;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-all duration-150 group"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 transition-colors duration-150 flex-shrink-0">
              <IconComponent className="w-4 h-4" />
            </span>
            <span className="leading-tight">{s.titulo}</span>
          </a>
        );
      })}
    </nav>
  );
}

function FinalCTA() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeUp}
      className="mt-16 rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-cyan-50 border border-indigo-100 p-8 text-center space-y-4"
    >
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-[0_8px_24px_-6px_rgba(79,70,229,0.45)] mb-2">
        <QuestionMarkCircleIcon className="w-6 h-6" />
      </span>
      <h3 className="text-xl font-bold text-slate-900 tracking-tight">
        No encontraste tu respuesta
      </h3>
      <p className="text-slate-600 text-sm leading-relaxed max-w-md mx-auto">
        Nuestro equipo responde en menos de 24 horas habiles. Escríbenos y
        resolveremos tu duda directamente.
      </p>
      <a
        href="mailto:hector@hectoria.mx"
        className="group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold text-sm shadow-[0_8px_24px_-6px_rgba(79,70,229,0.5)] hover:shadow-[0_10px_30px_-4px_rgba(6,182,212,0.55)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
      >
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <span className="relative">Escribir a hector@hectoria.mx</span>
        <ArrowRightIcon className="w-4 h-4 relative" />
      </a>
    </motion.div>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-12 px-6 mt-24">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2 text-lg font-black tracking-tight">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-500 text-white">
            <BoltIcon className="w-3.5 h-3.5" />
          </span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-500">
            Lumina
          </span>
        </div>
        <div className="flex gap-6 text-sm">
          <Link href="/precios" className="text-slate-500 hover:text-indigo-600 transition-colors">
            Precios
          </Link>
          <Link href="/ayuda" className="text-slate-500 hover:text-indigo-600 transition-colors">
            Ayuda
          </Link>
          <Link href="/login" className="text-slate-500 hover:text-indigo-600 transition-colors">
            Login
          </Link>
          <a
            href="https://hectoria.mx"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-indigo-600 transition-colors"
          >
            hectoria.mx
          </a>
        </div>
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <span>© 2026 Hectoria.</span>
          <span aria-hidden>MX</span>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-6 text-[11px] text-slate-400 text-center">
        No afiliado a operadores oficiales · Software para distribuidores autorizados
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Page                                                                     */
/* ──────────────────────────────────────────────────────────────────────── */

export default function AyudaPage() {
  const [query, setQuery] = useState("");

  const lower = query.toLowerCase().trim();

  // Filter sections to only those with matching items (for empty-state logic)
  const visibleSections = lower
    ? SECTIONS.filter((s) =>
        s.items.some(
          (item) =>
            item.q.toLowerCase().includes(lower) ||
            item.a.toLowerCase().includes(lower)
        )
      )
    : SECTIONS;

  return (
    <main className="min-h-screen flex flex-col bg-white text-slate-900 antialiased overflow-x-hidden">
      <TopNav />

      <HeroSection query={query} onChange={setQuery} />

      {/* Main content: sidebar + FAQ */}
      <div className="max-w-7xl mx-auto w-full px-6 pb-4">
        {/* Divider */}
        <div className="border-t border-slate-100" />

        {visibleSections.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-24 text-center space-y-4"
          >
            <CheckCircleIcon className="w-12 h-12 text-slate-200 mx-auto" />
            <p className="text-xl font-semibold text-slate-900">
              Sin resultados para &quot;{query}&quot;
            </p>
            <p className="text-slate-500 text-sm">
              Prueba con otras palabras o escríbenos directamente.
            </p>
            <a
              href="mailto:hector@hectoria.mx"
              className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm hover:text-cyan-600 transition-colors"
            >
              Contactar soporte
              <ArrowRightIcon className="w-4 h-4" />
            </a>
          </motion.div>
        ) : (
          <div className="flex gap-12 py-12 lg:py-16">
            {/* Sidebar — sticky, visible only on lg+ */}
            <aside className="hidden lg:block w-56 xl:w-64 flex-shrink-0">
              <div className="sticky top-24">
                <Sidebar sections={visibleSections} />

                {/* Mini contact card */}
                <div className="mt-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-cyan-50 border border-indigo-100 p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Soporte directo
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Lun-Vie · 9am-7pm CDMX
                    <br />
                    Respuesta &lt; 24h hábiles
                  </p>
                  <a
                    href="mailto:hector@hectoria.mx"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-cyan-600 transition-colors"
                  >
                    hector@hectoria.mx
                    <ArrowRightIcon className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </aside>

            {/* FAQ sections */}
            <div className="flex-1 min-w-0 space-y-12">
              {SECTIONS.map((section) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  query={query}
                />
              ))}

              <FinalCTA />
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
