"use client";

import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useId, useState } from "react";
import { ArrowRightIcon } from "@/components/icons";

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

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailId = useId();
  const errorId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        // Aún con error, mostramos el mensaje neutral — no confirmamos nada.
        setSent(true);
        return;
      }
      setSent(true);
    } catch {
      setError(
        "No pudimos conectar con el servidor. Revisa tu internet e intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid grid-cols-1 bg-white text-slate-900 antialiased overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      <section className="relative flex flex-col px-6 py-10 sm:px-10 lg:px-16 lg:py-14 bg-white z-10 overflow-y-auto">
        <div className="relative z-10 mb-10 flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowRightIcon className="w-4 h-4 rotate-180 mr-1.5" aria-hidden />
            Volver a iniciar sesión
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

        <div className="relative z-10 flex-1 flex items-center justify-center">
          <motion.div
            className="w-full max-w-md mx-auto"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.h1
              variants={itemVariants}
              className="text-4xl font-extrabold tracking-tight text-slate-900"
            >
              Recuperar acceso
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-slate-600 mt-3 leading-relaxed font-medium"
            >
              Ingresa el correo de tu cuenta y te enviaremos instrucciones.
            </motion.p>

            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-10 rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-5 text-emerald-800 text-sm leading-relaxed"
                  role="status"
                >
                  Si tu cuenta existe, recibirás un email con instrucciones en
                  unos minutos. Revisa también tu carpeta de spam.
                  <div className="mt-4">
                    <Link
                      href="/login"
                      className="text-indigo-600 hover:text-indigo-800 font-bold text-xs uppercase tracking-widest transition-colors"
                    >
                      Volver a iniciar sesión
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  variants={containerVariants}
                  onSubmit={handleSubmit}
                  className="space-y-5 mt-10"
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
                      className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold tracking-wide transition-colors shadow-lg shadow-indigo-200/50 focus:outline-none focus:ring-4 focus:ring-indigo-300"
                    >
                      {loading ? "Enviando..." : "Enviar instrucciones"}
                    </motion.button>
                  </motion.div>

                  <motion.div
                    variants={itemVariants}
                    className="text-center pt-2"
                  >
                    <Link
                      href="/login"
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
                    >
                      Volver a iniciar sesión
                    </Link>
                  </motion.div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
