"use client";

/**
 * ConciergeWidget — chat público "Aria" para visitantes pre-login.
 *
 * UX (estilo Intercom):
 *  - Bubble pill gradient indigo→cyan abajo-derecha cuando está cerrado.
 *  - Panel 380x560 cuando se expande con AnimatePresence (scale + opacity).
 *  - Header con avatar Sparkles, "Aria · En línea" + dot mint pulse.
 *  - Conversation thread: bubbles user (gradient) vs Aria (slate-50).
 *  - TypingDots stagger mientras llega el primer chunk.
 *  - Quick suggestion chips iniciales (4 preguntas tipo FAQ).
 *  - Composer textarea auto-resize + send button gradient (Enter envía).
 *  - CTA inline tras ≥4 mensajes intercambiados (2 user + 2 assistant).
 *
 * Streaming:
 *  - POST /api/concierge con todo el thread, lee Server-Sent Events.
 *  - Anexa chunks al último mensaje assistant on the fly.
 *  - Manejo de errores: rate_limit (429) → toast inline, errores genéricos
 *    se muestran como mensaje del asistente.
 *
 * Persistencia: sessionStorage por tab, key "concierge:thread:v1". Se borra
 * con el botón "Limpiar" o al cerrar la pestaña.
 *
 * A11Y:
 *  - role="dialog" + aria-modal cuando está abierto.
 *  - aria-live="polite" en el thread para anunciar nuevos mensajes.
 *  - Escape cierra el panel; focus al textarea al abrir.
 *  - Trap mínimo: el botón cerrar y el textarea quedan tabbable.
 */

import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { MessageCircle, Send, Sparkles, X, RefreshCw } from "lucide-react";

// ---------- Tipos & constantes ----------

type Role = "user" | "assistant";
interface UIMessage {
  id: string;
  role: Role;
  content: string;
  /** true mientras está recibiendo chunks SSE */
  streaming?: boolean;
  /** mensaje informativo de error (rate limit, network) */
  error?: boolean;
}

const STORAGE_KEY = "concierge:thread:v1";
const SUGGESTIONS = [
  "¿Cuánto cuesta?",
  "¿Necesito tarjeta?",
  "¿Qué planes Telcel cotizan?",
  "¿Cómo es la demo?",
] as const;
const MAX_INPUT = 2000;

const WELCOME: UIMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "¡Hola! Soy Aria, asistente del cotizador. Pregúntame lo que quieras sobre planes, precios o cómo funciona.",
};

// Mostramos el CTA tras 2 mensajes del usuario (entre 4 y 6 bubbles totales).
function shouldShowSignupCTA(messages: UIMessage[]): boolean {
  const userMsgs = messages.filter((m) => m.role === "user").length;
  return userMsgs >= 2;
}

// ---------- Animaciones ----------

const panelVariants: Variants = {
  closed: { opacity: 0, scale: 0.92, y: 12, transformOrigin: "bottom right" },
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
};

const bubbleVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ---------- Helpers ----------

function newId(): string {
  // Lo suficientemente único para el ciclo de una conversación.
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadThread(): UIMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out: UIMessage[] = [];
    for (const m of parsed) {
      if (
        m &&
        typeof m === "object" &&
        typeof (m as UIMessage).id === "string" &&
        ((m as UIMessage).role === "user" ||
          (m as UIMessage).role === "assistant") &&
        typeof (m as UIMessage).content === "string"
      ) {
        out.push({
          id: (m as UIMessage).id,
          role: (m as UIMessage).role,
          content: (m as UIMessage).content,
        });
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function saveThread(messages: UIMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    // No guardamos mensajes en streaming ni errores transientes.
    const clean = messages.filter((m) => !m.streaming && !m.error);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    /* quota / disabled — no es crítico */
  }
}

/**
 * Parser SSE manual sobre el ReadableStream. El SDK no expone un helper
 * cliente listo; reimplementamos el contrato mínimo: bloques separados
 * por "\n\n", cada bloque puede tener "event:" y "data:".
 */
async function* parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) yield { event, data };
    }
  }
}

// ---------- Componente principal ----------

export function ConciergeWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hidratar desde sessionStorage al primer mount.
  useEffect(() => {
    const persisted = loadThread();
    if (persisted && persisted.length > 0) {
      setMessages([WELCOME, ...persisted.filter((m) => m.id !== WELCOME.id)]);
    }
  }, []);

  // Persistir cuando cambia el thread (sin mensajes en streaming).
  useEffect(() => {
    if (isStreaming) return;
    saveThread(messages.filter((m) => m.id !== WELCOME.id));
  }, [messages, isStreaming]);

  // Auto-scroll al final cuando llegan chunks o nuevos mensajes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // Focus al textarea cuando se abre.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Escape para cerrar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Cancelar fetch al desmontar.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const showCTA = useMemo(() => shouldShowSignupCTA(messages), [messages]);
  const showSuggestions = messages.length === 1; // sólo welcome

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const userMsg: UIMessage = {
        id: newId(),
        role: "user",
        content: trimmed.slice(0, MAX_INPUT),
      };
      const assistantId = newId();
      const assistantPlaceholder: UIMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      // Snapshot del historial que vamos a mandar (excluye placeholder).
      // Mandamos sin el welcome para no consumir tokens innecesarios — el
      // system prompt ya cubre la presentación.
      const historyForApi = [
        ...messages.filter((m) => m.id !== WELCOME.id && !m.error),
        userMsg,
      ].map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setInput("");
      setIsStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/concierge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForApi }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          let errMsg = "No pude responder. Intenta de nuevo.";
          if (res.status === 429) {
            errMsg =
              "Demasiadas preguntas seguidas. Espera un momento e intenta de nuevo.";
          } else if (res.status === 503) {
            errMsg =
              "Aria no está disponible ahora. Escríbele a Hector vía Telegram.";
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: errMsg, streaming: false, error: true }
                : m,
            ),
          );
          return;
        }

        if (!res.body) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Respuesta vacía del servidor.",
                    streaming: false,
                    error: true,
                  }
                : m,
            ),
          );
          return;
        }

        const reader = res.body.getReader();
        let acc = "";
        for await (const { event, data } of parseSSE(reader)) {
          if (event === "message") {
            try {
              const parsed = JSON.parse(data) as { delta?: string };
              if (parsed.delta) {
                acc += parsed.delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: acc } : m,
                  ),
                );
              }
            } catch {
              /* chunk inválido — saltamos */
            }
          } else if (event === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content:
                        acc ||
                        "Tuve un problema procesando tu mensaje. Intenta de nuevo.",
                      streaming: false,
                      error: !acc,
                    }
                  : m,
              ),
            );
            return;
          } else if (event === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, streaming: false } : m,
              ),
            );
          }
        }

        // Si el stream terminó sin "done" explícito, marcamos como cerrado.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.streaming
              ? { ...m, streaming: false }
              : m,
          ),
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "No pude conectar. Revisa tu conexión.",
                  streaming: false,
                  error: true,
                }
              : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void sendMessage(input);
    },
    [input, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  const handleInput = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const ta = e.target;
    setInput(ta.value.slice(0, MAX_INPUT));
    // Auto-resize hasta 5 líneas (~120px).
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, []);

  const resetThread = useCallback(() => {
    abortRef.current?.abort();
    setMessages([WELCOME]);
    setInput("");
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
    }
  }, []);

  // ---------- Render ----------

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="false"
            aria-label="Asistente Aria"
            variants={panelVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="w-[360px] sm:w-[380px] h-[560px] max-h-[80vh] bg-white rounded-3xl border border-slate-200 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.35)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="relative px-4 py-3 border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 via-cyan-500 to-pink-500 text-white shadow-[0_0_18px_rgba(79,70,229,0.35)]">
                    <Sparkles className="w-5 h-5" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">Aria</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="relative inline-flex w-2 h-2">
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                      <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
                    </span>
                    En línea
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetThread}
                  title="Reiniciar conversación"
                  aria-label="Reiniciar conversación"
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-white"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar chat"
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thread */}
            <div
              ref={scrollRef}
              aria-live="polite"
              aria-label="Conversación con Aria"
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/40"
            >
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {showCTA && !isStreaming && (
                <motion.div
                  variants={bubbleVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-2 flex justify-center"
                >
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-xs font-semibold shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
                  >
                    ¿Quieres probarlo tú mismo? Crea cuenta gratis →
                  </Link>
                </motion.div>
              )}
            </div>

            {/* Suggestions */}
            {showSuggestions && (
              <div className="px-4 pt-2 pb-1 flex flex-wrap gap-2 border-t border-slate-100 bg-white">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendMessage(s)}
                    disabled={isStreaming}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={handleSubmit}
              className="px-3 py-3 border-t border-slate-200 bg-white"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all px-3 py-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Pregúntale a Aria…"
                  rows={1}
                  maxLength={MAX_INPUT}
                  className="flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none leading-relaxed py-1"
                  aria-label="Escribir mensaje"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  aria-label="Enviar mensaje"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-400 text-center">
                Aria puede equivocarse. Para datos de tu cuenta,{" "}
                <Link
                  href="/signup"
                  className="text-indigo-600 hover:underline"
                >
                  regístrate
                </Link>
                .
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble launcher */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente" : "Habla con Aria"}
        aria-expanded={open}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 18 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="inline-flex items-center gap-2 pl-3 pr-5 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-cyan-500 to-indigo-600 bg-[length:200%_100%] text-white font-semibold text-sm shadow-[0_10px_30px_-8px_rgba(79,70,229,0.5)] hover:bg-[position:100%_0] transition-all"
      >
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm">
          <MessageCircle className="w-4 h-4" />
        </span>
        {open ? "Cerrar" : "Habla con Aria"}
      </motion.button>
    </div>
  );
}

// ---------- Sub-componente: bubble ----------

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const isTyping = message.streaming && message.content.length === 0;

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-md"
            : message.error
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-white text-slate-800 border border-slate-200 shadow-sm",
        ].join(" ")}
      >
        {isTyping ? <TypingDots /> : message.content}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span
      className="inline-flex items-center gap-1 py-1"
      aria-label="Aria está escribiendo"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-slate-400"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

export default ConciergeWidget;
