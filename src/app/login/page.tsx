"use client";

import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from "@/components/icons";

const TELEGRAM_BOT_USERNAME = "CMdemobot";

// Type augmentation: el callback global que el widget de Telegram llama.
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Mensajes de error según copy/login.md sección 3. Un mapa local evita que el
// servidor tenga que conocer el wording final y mantiene el "qué hacer ahora"
// del usuario aquí, junto a la UI.
function friendlyAuthError(serverError: string | undefined): string {
  const msg = (serverError || "").toLowerCase();
  if (
    msg.includes("credencial") ||
    msg.includes("credentials") ||
    msg.includes("invalid") ||
    msg.includes("password") ||
    msg.includes("unauthorized")
  ) {
    return "Email o contraseña no coinciden. Revisa que no haya espacios o mayúsculas de más, o entra con Telegram si prefieres.";
  }
  if (msg.includes("pending") || msg.includes("rfc") || msg.includes("activ")) {
    return "Tu cuenta aún no está activada. Validamos tu RFC en horas hábiles — si han pasado más de 24h, escríbenos a hola@hectoria.mx con el asunto 'alta pendiente'.";
  }
  return serverError && serverError.trim().length > 0
    ? serverError
    : "Email o contraseña no coinciden. Revisa que no haya espacios o mayúsculas de más, o entra con Telegram si prefieres.";
}

// Variants framer-motion para stagger del form.
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const telegramContainerRef = useRef<HTMLDivElement>(null);

  // IDs estables para asociar <label htmlFor> y aria-describedby (A11Y A3/A4).
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  // Inyectar el script del widget Telegram en el DOM real (React no ejecuta
  // scripts insertados con dangerouslySetInnerHTML). Y registrar el callback
  // global que el widget invocará al autenticar.
  useEffect(() => {
    // Callback global que el widget invoca con los datos del usuario.
    window.onTelegramAuth = async (user: TelegramUser) => {
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        if (!res.ok) {
          setError(
            "Tu sesión de Telegram expiró antes de poder validarla. Vuelve a tocar el botón de Telegram para intentar de nuevo.",
          );
          return;
        }
        window.location.href = "/dashboard";
      } catch {
        setError(
          "No pudimos conectar con el servidor. Revisa tu internet y vuelve a intentar; si sigue, avísanos en @hectoria.mx.",
        );
      }
    };

    // Inyectar el <script> real del widget Telegram.
    const container = telegramContainerRef.current;
    if (!container) return;
    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(friendlyAuthError(data.error));
      }
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      // Error de red (fetch lanza TypeError cuando no hay conexión) vs error
      // ya formateado por el throw de arriba.
      if (e instanceof TypeError) {
        setError(
          "No pudimos conectar con el servidor. Revisa tu internet y vuelve a intentar; si sigue, avísanos en @hectoria.mx.",
        );
      } else {
        setError(e instanceof Error ? e.message : friendlyAuthError(undefined));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white text-slate-900 antialiased overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      {/* LEFT pane: formulario (bg-white) */}
      <section className="relative flex flex-col px-6 py-10 sm:px-10 lg:px-16 lg:py-14 bg-white z-10 overflow-y-auto">
        <div className="relative z-10 mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowRightIcon className="w-4 h-4 rotate-180 mr-1.5" aria-hidden />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-slate-900">
              Cotizador
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(45,212,191,0.25)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Beta
            </span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex items-center">
          <motion.div
            className="w-full max-w-md mx-auto"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-4xl font-extrabold tracking-tight text-slate-900"
            >
              Iniciar sesión
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-slate-600 mt-3 leading-relaxed font-medium"
            >
              Distribuidores autorizados Telcel: usa Telegram para entrar en un
              toque, o tu email si prefieres.
            </motion.p>

            <motion.div variants={itemVariants} className="mt-8">
              {/* Telegram Login Widget oficial. Dominio aprobado en BotFather:
                  cotizador.hectoria.mx. El script se inyecta desde useEffect
                  (React no ejecuta scripts via dangerouslySetInnerHTML). */}
              <div
                ref={telegramContainerRef}
                className="flex justify-center min-h-[44px]"
              />
              <p className="text-xs text-center text-slate-500 mt-2">
                ¿No ves el botón de Telegram? Puede ser un bloqueador o tu red
                corporativa — desactívalo o entra con email.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="mt-8 flex items-center"
              aria-hidden
            >
              <div className="flex-grow border-t border-slate-200" />
              <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                o continuar con email
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </motion.div>

            <motion.form
              variants={containerVariants}
              onSubmit={handleSubmit}
              className="space-y-5 mt-8"
              noValidate
            >
              <motion.div variants={itemVariants}>
                <label
                  htmlFor={emailId}
                  className="block text-xs font-bold tracking-widest text-slate-500 uppercase mb-2 ml-1"
                >
                  Correo electrónico
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="distribuidor@telcel.com"
                  autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label
                    htmlFor={passwordId}
                    className="block text-xs font-bold tracking-widest text-slate-500 uppercase"
                  >
                    Contraseña
                  </label>
                  <Link
                    href="/recuperar"
                    className="text-[10px] uppercase tracking-widest text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
                  >
                    ¿Olvidaste?
                  </Link>
                </div>
                <input
                  id={passwordId}
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium"
                />
              </motion.div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    key="error"
                    id={errorId}
                    role="alert"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div variants={itemVariants}>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="relative w-full overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white font-bold py-3.5 px-6 shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_12px_34px_rgba(79,70,229,0.4)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  {/* Shimmer overlay: translate -100% → 100% on hover (CSS) */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                  />
                  <span className="relative inline-flex items-center justify-center gap-2">
                    {loading ? "Entrando..." : "Ingresar al portal"}
                    {!loading && (
                      <ArrowRightIcon className="w-4 h-4" aria-hidden />
                    )}
                  </span>
                </motion.button>
              </motion.div>
            </motion.form>

            <motion.p
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="text-sm text-slate-600 text-center leading-relaxed mt-6"
            >
              ¿No tienes cuenta?{" "}
              <Link
                href="/signup"
                className="text-cyan-700 font-semibold hover:underline"
              >
                Regístrate
              </Link>{" "}
              — respondemos en menos de 24h hábiles.
            </motion.p>

            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="mt-10 flex flex-wrap gap-2 justify-center"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Datos en México
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Cifrado E2E
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Logs auditables
              </span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* RIGHT pane: visual (oculto en mobile) */}
      <aside
        className="hidden lg:flex relative flex-col justify-center items-center overflow-hidden bg-gradient-to-br from-indigo-50 via-cyan-50 to-pink-50"
        aria-hidden
      >
        {/* Grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.18] mix-blend-multiply pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")",
          }}
        />

        {/* Floating background blobs (4+) */}
        <FloatingBlobs />

        <LoginVisual />

        <div className="absolute bottom-6 right-8 text-xs font-medium text-slate-400 z-10">
          Hecho en México 🇲🇽
        </div>
      </aside>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* FloatingBlobs — 4 motion.div decorativos en background con rotate+translate */
/* ---------------------------------------------------------------------- */

function FloatingBlobs() {
  return (
    <>
      <motion.div
        className="absolute top-[8%] left-[6%] w-96 h-96 rounded-full blur-3xl bg-indigo-300/40 mix-blend-multiply"
        animate={{
          x: [0, 30, -10, 0],
          y: [0, -20, 15, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-[6%] right-[8%] w-[28rem] h-[28rem] rounded-full blur-3xl bg-cyan-300/40 mix-blend-multiply"
        animate={{
          x: [0, -25, 20, 0],
          y: [0, 25, -15, 0],
          rotate: [360, 180, 0],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-[35%] right-[12%] w-72 h-72 rounded-full blur-3xl bg-pink-300/30 mix-blend-multiply"
        animate={{
          x: [0, 20, -20, 0],
          y: [0, -25, 20, 0],
          rotate: [0, 120, 240, 360],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-[20%] left-[12%] w-80 h-80 rounded-full blur-3xl bg-violet-200/40 mix-blend-multiply"
        animate={{
          x: [0, 25, -15, 0],
          y: [0, 20, -10, 0],
          rotate: [180, 90, 0, 360, 180],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* LoginVisual — Mockup card con folio 2378845 + chips flotantes           */
/* ---------------------------------------------------------------------- */

function LoginVisual() {
  return (
    <div className="relative z-10 w-full max-w-md px-8">
      {/* Floating chip top-left: AB 25% aplicado */}
      <motion.div
        initial={{ opacity: 0, y: -10, x: -20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
        className="absolute -left-8 top-10 z-20"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-3 bg-white/90 backdrop-blur-md rounded-2xl px-3 py-2.5 shadow-xl shadow-cyan-200/40 border border-white/60"
        >
          <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
            <BoltIcon className="w-4 h-4" />
          </span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              A/B mensual
            </div>
            <div className="text-sm font-bold text-slate-900">25% aplicado</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating chip top-right: +18.4% margen */}
      <motion.div
        initial={{ opacity: 0, y: -10, x: 20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ delay: 0.75, duration: 0.6, ease: "easeOut" }}
        className="absolute -right-6 top-2 z-20"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-xl shadow-indigo-200/40 border border-white/60"
        >
          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <ArrowTrendingUpIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Margen
            </div>
            <div className="text-sm font-bold text-slate-900">+18.4%</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Main mockup card: cotización completada — float continuo */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-7 shadow-2xl shadow-indigo-200/50 border border-white/60 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-100/50 to-transparent rounded-bl-full pointer-events-none" />

          <div className="relative flex justify-between items-start mb-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                Cotización completada
              </span>
            </div>
            <div className="text-xs font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-1 rounded-md">
              #2378845
            </div>
          </div>

          <div className="relative mb-5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Cliente
            </div>
            <p className="text-sm text-slate-700 font-medium leading-tight">
              Celumaster ·{" "}
              <span className="font-mono text-slate-900">LUFJ831214AHA</span> ·
              5 líneas
            </p>
          </div>

          <div className="relative mb-6">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Valor total (MXN)
            </div>
            <div className="font-extrabold text-3xl text-slate-900 tracking-tight tabular-nums">
              $80,067
              <span className="text-2xl text-slate-400">.50</span>
            </div>
          </div>

          {/* Mini area chart placeholder (Recharts opcional - mantengo bars CSS) */}
          <div className="relative h-14 w-full rounded-xl bg-gradient-to-r from-cyan-50 to-indigo-50 flex items-end p-2 mb-5">
            <div className="w-full h-8 flex items-end gap-1">
              <div className="w-1/6 bg-cyan-200 rounded-t-sm h-1/4" />
              <div className="w-1/6 bg-cyan-300 rounded-t-sm h-2/4" />
              <div className="w-1/6 bg-cyan-400 rounded-t-sm h-1/3" />
              <div className="w-1/6 bg-indigo-300 rounded-t-sm h-3/4" />
              <div className="w-1/6 bg-indigo-400 rounded-t-sm h-2/3" />
              <div className="w-1/6 bg-indigo-500 rounded-t-sm h-full" />
            </div>
          </div>

          <div className="relative flex gap-2">
            <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 px-3 py-2.5 rounded-full shadow-[0_8px_20px_rgba(79,70,229,0.25)]">
              <DocumentTextIcon className="w-3.5 h-3.5" />
              PDF cliente
            </span>
            <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-2.5 rounded-full">
              <DocumentTextIcon className="w-3.5 h-3.5" />
              PDF interno
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating bottom-right testimonial chip */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.6, ease: "easeOut" }}
        className="absolute -right-4 -bottom-8 z-20"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-3 bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-xl shadow-pink-200/40 border border-white/60 max-w-[14rem]"
        >
          <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md">
            <CheckCircleIcon className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              2 min vs 90 min
            </div>
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              en Excel manual
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
