"use client";

/**
 * ARIA Copilot — agente IA flotante post-login.
 *
 * Vanguardia 2026 estilo Linear/Vercel/Stripe sobre LUMINA Light Premium.
 *
 * - Botón flotante esquina inferior-derecha (z-50 fixed). 56px circle gradient
 *   indigo→cyan + glow. Pulse subtle infinite los primeros 30s (hint atención).
 * - Click → panel 420px (mobile full-screen) con motion fade-up.
 * - Header: avatar gradient + "Aria" + status pulse dot "En vivo".
 * - Welcome (primera vez): saludo personalizado + quick suggestion chips
 *   contextuales a la página actual (usePathname).
 * - Conversation thread con bubbles glass light. Assistant: white border-200.
 *   User: gradient indigo→cyan text-white.
 * - Streaming typing dots framer-motion stagger mientras Aria responde.
 * - Rich cards inline para tool_result (cotizaciones / clientes / KPIs).
 * - Action chips para tool_use (write tools: navigate_to / apply_palanca).
 * - Input textarea auto-resize + send pill gradient.
 * - ⌘K / Ctrl-K abre desde cualquier pantalla. Esc cierra.
 * - Persistencia sessionStorage `aria-copilot-thread` para sobrevivir page changes.
 * - A11Y: focus trap manual al input, aria-live="polite" en thread, aria-label.
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
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { Sparkles, X, ArrowUp, Bot, Loader2, Settings } from "lucide-react";
import { useAriaVoice } from "@/lib/hooks/useAriaVoice";
import {
  MicButton,
  SpeakerToggle,
  SpeakMessageButton,
  VoiceSettingsPanel,
  VoiceWaveform,
} from "@/components/copilot/voice";

/* ─────────────────── Tipos ─────────────────── */

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Rich attachments materializados desde tool_result/tool_use. */
  cards?: RichCard[];
  /** Action chips (write tools dispatched, esperando user click). */
  actions?: ActionChip[];
  pending?: boolean; // true mientras streamea
}

type RichCard =
  | { kind: "cotizaciones"; data: CotizacionLite[] }
  | { kind: "clientes"; data: ClienteLite[] }
  | { kind: "kpis"; data: KpisLite };

interface CotizacionLite {
  folio: string | null;
  id: string;
  rfc?: string;
  lineas?: number;
  plan?: number;
  monto?: number;
  estado?: string;
}
interface ClienteLite {
  rfc?: string;
  razon_social?: string;
  cotizaciones?: number;
}
interface KpisLite {
  period: string;
  cotizaciones: number;
  montoTotal: number;
  ticketPromedio: number;
  abPromedio: number;
  clientesActivos: number;
}

interface ActionChip {
  label: string;
  /** Cuando el user hace click: ejecutar inmediatamente. */
  exec: () => void;
}

interface AriaCopilotProps {
  userName?: string;
}

/* ─────────────────── Constantes ─────────────────── */

const STORAGE_KEY = "aria-copilot-thread";
const MAX_INPUT_LEN = 2000;
const PULSE_HINT_MS = 30_000;

const SUGGESTIONS_BY_PATH: Record<string, string[]> = {
  "/dashboard": [
    "¿Cuál es mi A/B promedio?",
    "Top cliente del mes",
    "Resumir mis ventas",
  ],
  "/dashboard/cotizar": [
    "¿Cómo cotizar para persona física?",
    "Explicar palancas",
    "Ejemplo plan VPN",
  ],
  "/dashboard/historial": [
    "Filtrar último mes",
    "Cotizaciones >$50k",
    "Exportar a Excel",
  ],
  "/dashboard/clientes": [
    "Cliente con más cotizaciones",
    "Crear nuevo cliente",
  ],
  "/dashboard/optimizar": [
    "¿Qué palanca conviene?",
    "Optimizar al 25%",
  ],
};
const FALLBACK_SUGGESTIONS = [
  "¿Cómo funciona el cotizador?",
  "Ayuda con plazos",
  "FAQ",
];

function suggestionsFor(pathname: string): string[] {
  if (SUGGESTIONS_BY_PATH[pathname]) return SUGGESTIONS_BY_PATH[pathname];
  // Match prefix (e.g. /dashboard/cliente/[rfc] usa /dashboard/clientes)
  for (const key of Object.keys(SUGGESTIONS_BY_PATH)) {
    if (pathname.startsWith(key)) return SUGGESTIONS_BY_PATH[key];
  }
  return FALLBACK_SUGGESTIONS;
}

function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function formatMxnShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

/* ─────────────────── Componente raíz ─────────────────── */

export default function AriaCopilot({ userName }: AriaCopilotProps) {
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";

  // No mostrar en rutas no-dashboard (defensive: el layout ya filtra).
  const shouldRender = pathname.startsWith("/dashboard");

  const [open, setOpen] = useState(false);
  const [pulseHint, setPulseHint] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ── Capa de voz (mic input + TTS output) ── */
  const [settingsOpen, setSettingsOpen] = useState(false);
  // ID del mensaje que actualmente se está leyendo en voz alta (para que
  // SpeakMessageButton sepa cuál muestra estado "Detener".
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  // Ref forward para que el callback de auto-send pueda usar la versión más
  // reciente de `send` sin re-crear el hook (que provocaría re-listening loop).
  const sendRef = useRef<((t: string) => void) | null>(null);
  const voice = useAriaVoice({
    onAutoSend: (text) => {
      sendRef.current?.(text);
    },
    autoSend: true,
    // TODO: cuando `/api/tts/elevenlabs` exista, hacer un ping a `/api/tts/health`
    // al montar y pasar el resultado aquí. Por ahora false → switch premium gris.
    premiumAvailable: false,
  });

  /* ── Hydration: cargar thread desde sessionStorage ── */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) {
          // Drop chips/actions (closures no se serializan).
          setMessages(
            parsed.map((m) => ({
              ...m,
              actions: undefined,
              pending: false,
            })),
          );
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  /* ── Persist thread on change ── */
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      // Strip action callbacks before persisting.
      const serializable = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        cards: m.cards,
      }));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      /* quota etc */
    }
  }, [messages]);

  /* ── Pulse hint timeout ── */
  useEffect(() => {
    const t = setTimeout(() => setPulseHint(false), PULSE_HINT_MS);
    return () => clearTimeout(t);
  }, []);

  /* ── Cmd-K / Ctrl-K global ── */
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* ── Focus input on open ── */
  useEffect(() => {
    if (open) {
      // requestAnimationFrame para evitar conflicto con animation enter.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /* ── Auto-scroll a último msg ── */
  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  /* ── Auto-resize textarea ── */
  function autoResize(el: HTMLTextAreaElement | null): void {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  /* ── Enviar mensaje ── */
  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || streaming) return;
      setError(null);

      // Push user msg + placeholder assistant msg.
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: clean,
      };
      const asstId = uid();
      const asstMsg: ChatMessage = {
        id: asstId,
        role: "assistant",
        content: "",
        pending: true,
      };
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setInput("");
      setStreaming(true);

      // Conversation history a enviar (excluyendo el placeholder pending).
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            pageContext: { pathname },
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let msg = `Error ${res.status}`;
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* ignore */
          }
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? {
                    ...m,
                    pending: false,
                    content: `Lo siento, no pude responder (${msg}).`,
                  }
                : m,
            ),
          );
          setStreaming(false);
          return;
        }

        // Parse SSE stream manually.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const collectedCards: RichCard[] = [];
        const collectedActions: ActionChip[] = [];

        const flushPatch = () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? {
                    ...m,
                    cards: collectedCards.length
                      ? [...collectedCards]
                      : undefined,
                    actions: collectedActions.length
                      ? [...collectedActions]
                      : undefined,
                  }
                : m,
            ),
          );
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Split SSE events on double newline.
          let idx;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const line = rawEvent.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            let evt: {
              type: string;
              text?: string;
              name?: string;
              input?: Record<string, unknown>;
              data?: unknown;
              message?: string;
            };
            try {
              evt = JSON.parse(json);
            } catch {
              continue;
            }
            if (evt.type === "delta" && typeof evt.text === "string") {
              const t = evt.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstId
                    ? { ...m, content: m.content + t }
                    : m,
                ),
              );
            } else if (evt.type === "tool_result" && evt.name && evt.data) {
              if (evt.name === "search_cotizaciones") {
                const d = evt.data as { cotizaciones?: CotizacionLite[] };
                if (Array.isArray(d.cotizaciones) && d.cotizaciones.length) {
                  collectedCards.push({
                    kind: "cotizaciones",
                    data: d.cotizaciones,
                  });
                }
              } else if (evt.name === "search_clientes") {
                const d = evt.data as { clientes?: ClienteLite[] };
                if (Array.isArray(d.clientes) && d.clientes.length) {
                  collectedCards.push({ kind: "clientes", data: d.clientes });
                }
              } else if (evt.name === "get_kpis") {
                collectedCards.push({
                  kind: "kpis",
                  data: evt.data as KpisLite,
                });
              }
              flushPatch();
            } else if (evt.type === "tool_use" && evt.name) {
              // WRITE tool: emitir action chip que el user puede pulsar.
              if (evt.name === "navigate_to") {
                const path =
                  typeof evt.input?.path === "string"
                    ? (evt.input.path as string)
                    : null;
                if (path) {
                  collectedActions.push({
                    label: `Ir a ${path} →`,
                    exec: () => {
                      router.push(path);
                      setOpen(false);
                    },
                  });
                }
              } else if (evt.name === "apply_palanca") {
                const tipo = String(evt.input?.tipo ?? "palanca");
                const valor = String(evt.input?.valor ?? "");
                collectedActions.push({
                  label: `Aplicar ${tipo}: ${valor}`,
                  exec: () => {
                    // Frontend hand-off: guardamos la intent en sessionStorage
                    // y navegamos a /dashboard/optimizar para que la página la
                    // recoja. Patrón ya usado por handoff /cotizar↔optimizar.
                    try {
                      sessionStorage.setItem(
                        "aria-copilot:palanca",
                        JSON.stringify({ tipo, valor }),
                      );
                    } catch {
                      /* ignore */
                    }
                    router.push("/dashboard/optimizar");
                    setOpen(false);
                  },
                });
              }
              flushPatch();
            } else if (evt.type === "error") {
              setError(evt.message || "Error en el agente");
            } else if (evt.type === "done") {
              // marca como completed
            }
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          // user cancel — no-op
        } else {
          console.error("[copilot] fetch error", e);
          setError("No pudimos conectar con Aria. Intenta de nuevo.");
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId
              ? {
                  ...m,
                  pending: false,
                  content: m.content || "No tuve respuesta. ¿Reformulas?",
                }
              : m,
          ),
        );
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, pathname, router, streaming],
  );

  // Mantener sendRef sync'd para que el callback de auto-send tras voice input
  // siempre llame a la versión más reciente sin re-crear el hook de voz.
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  /* ── Auto-speak respuesta del assistant cuando termina streaming ── */
  // Trackeamos qué mensajes ya hablamos para no re-leer al re-renderizar.
  const spokenIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!voice.settings.autoSpeak) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.pending) return;
    if (!last.content) return;
    if (spokenIdsRef.current.has(last.id)) return;
    spokenIdsRef.current.add(last.id);
    setSpeakingMsgId(last.id);
    voice.speakAssistantMessage(last.content);
  }, [messages, voice]);

  // Nota: no reseteamos `speakingMsgId` automáticamente cuando termina la
  // utterance. El Bubble computa "isSpeakingThis = voice.isSpeaking &&
  // speakingMsgId === m.id", así que la falsa positiva queda enmascarada.
  // Reset-en-effect causaría cascading render según el linter de Next 16.

  /* ── Sync transcripción interim de voz al textarea ── */
  // Mientras el user está hablando, mostramos lo interim como preview en el
  // textarea (gris/italic). Cuando termina (auto-send via useAriaVoice), el
  // transcript final entra como mensaje user y el textarea vuelve a "".
  useEffect(() => {
    if (voice.isListening && voice.interimTranscript) {
      // No tocamos `input` real — el preview va en un div aparte abajo del
      // composer para no interferir si el usuario también escribió a mano.
    }
  }, [voice.isListening, voice.interimTranscript]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) send(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) send(input);
    }
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value.slice(0, MAX_INPUT_LEN));
    autoResize(e.target);
  };

  const suggestions = useMemo(() => suggestionsFor(pathname), [pathname]);
  const greeting = userName ? `Hola ${userName}` : "Hola";

  if (!shouldRender) return null;

  return (
    <>
      {/* Floating launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="aria-launcher"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir Aria, asistente IA"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{
              scale: 1.05,
              boxShadow: "0 12px 50px rgba(79,70,229,0.55)",
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-[0_10px_40px_rgba(79,70,229,0.4)] focus:outline-none focus:ring-4 focus:ring-indigo-200"
          >
            {pulseHint && (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-full"
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(79,70,229,0.45)",
                    "0 0 0 16px rgba(79,70,229,0)",
                  ],
                }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
            )}
            <Sparkles className="w-6 h-6 relative" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="aria-panel"
            role="dialog"
            aria-modal="false"
            aria-label="Aria, asistente IA"
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="fixed bottom-6 right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[420px] max-h-[min(720px,calc(100vh-3rem))] flex flex-col rounded-3xl bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-br from-indigo-50/60 to-white">
              <div
                aria-hidden="true"
                className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-sm"
              >
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-slate-900 leading-tight">
                  Aria
                </p>
                <p className="text-[11px] text-slate-500 leading-tight flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  En vivo · puedo ejecutar acciones
                </p>
              </div>
              {/* Voice output toggle — solo si el browser soporta TTS. */}
              {voice.outputSupported && (
                <SpeakerToggle
                  enabled={voice.settings.autoSpeak}
                  isSpeaking={voice.isSpeaking}
                  onToggle={() =>
                    voice.patch({ autoSpeak: !voice.settings.autoSpeak })
                  }
                  onStop={voice.stopSpeaking}
                />
              )}
              {/* Gear icon → popover de settings de voz */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Configurar voz"
                  aria-expanded={settingsOpen}
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {settingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-10 z-10"
                    >
                      <VoiceSettingsPanel
                        settings={voice.settings}
                        onChange={voice.setSettings}
                        premiumAvailable={voice.premiumAvailable}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="button"
                aria-label="Cerrar Aria"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Thread */}
            <div
              ref={threadRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/40"
            >
              {messages.length === 0 ? (
                <WelcomeBlock
                  greeting={greeting}
                  suggestions={suggestions}
                  onPick={send}
                />
              ) : (
                messages.map((m) => (
                  <Bubble
                    key={m.id}
                    msg={m}
                    voiceEnabled={voice.outputSupported}
                    isSpeakingThis={speakingMsgId === m.id && voice.isSpeaking}
                    onSpeak={() => {
                      setSpeakingMsgId(m.id);
                      voice.speakNow(m.content);
                    }}
                    onStopSpeak={voice.stopSpeaking}
                  />
                ))
              )}
              {error && (
                <div
                  role="alert"
                  className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
                >
                  {error}
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={onSubmit}
              className="border-t border-slate-100 p-3 bg-white"
            >
              <div className="relative flex items-end gap-2 rounded-2xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100 bg-white transition px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={onChange}
                  onKeyDown={onKeyDown}
                  placeholder="Pregúntame o pídeme una acción…"
                  aria-label="Mensaje para Aria"
                  rows={1}
                  maxLength={MAX_INPUT_LEN}
                  className="flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none leading-snug max-h-40"
                />
                {/* Mic button — solo si SpeechRecognition existe + user no lo apagó. */}
                {voice.inputSupported && (
                  <MicButton
                    isListening={voice.isListening}
                    hasError={Boolean(voice.inputError)}
                    onToggle={voice.toggleListening}
                    disabled={streaming}
                    size={36}
                  />
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  aria-label="Enviar mensaje"
                  className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-sm enabled:hover:shadow-md enabled:hover:shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {streaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </div>
              {/* Interim transcript preview + waveform mientras escucha. */}
              <AnimatePresence>
                {voice.isListening && (
                  <motion.div
                    key="voice-interim"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="mt-2 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2"
                    aria-live="polite"
                  >
                    <VoiceWaveform active size={20} />
                    <p className="flex-1 text-xs italic text-slate-600 break-words">
                      {voice.interimTranscript || "Escuchando…"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {voice.inputError && !voice.isListening && (
                <p
                  role="alert"
                  className="mt-2 text-[11px] text-rose-600 text-center"
                >
                  {voice.inputError === "not-allowed"
                    ? "Permite acceso al micrófono en tu navegador para hablar con Aria."
                    : `Voz no disponible (${voice.inputError}).`}
                </p>
              )}
              <p className="mt-2 text-[10px] text-slate-400 text-center">
                ⌘K abre Aria desde cualquier pantalla · Esc cierra
              </p>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─────────────────── Sub-componentes ─────────────────── */

function WelcomeBlock({
  greeting,
  suggestions,
  onPick,
}: {
  greeting: string;
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-3"
    >
      <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200 p-3.5 shadow-sm">
        <p className="text-sm text-slate-900 leading-relaxed">
          <span className="font-bold">{greeting}</span>, soy Aria.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mt-1">
          Pregúntame sobre tus cotizaciones, clientes o pídeme que ejecute
          acciones — &ldquo;cotiza para X&rdquo;, &ldquo;muéstrame el historial&rdquo;,
          &ldquo;optimiza al 25%&rdquo;.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <motion.button
            key={s}
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPick(s)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition"
          >
            {s}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function Bubble({
  msg,
  voiceEnabled = false,
  isSpeakingThis = false,
  onSpeak,
  onStopSpeak,
}: {
  msg: ChatMessage;
  voiceEnabled?: boolean;
  isSpeakingThis?: boolean;
  onSpeak?: () => void;
  onStopSpeak?: () => void;
}) {
  const isUser = msg.role === "user";
  // Botón "leer en voz alta" solo en assistant + cuando hay TTS soportado +
  // hay texto real (no placeholder pending).
  const showSpeak =
    !isUser && voiceEnabled && !msg.pending && msg.content.length > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`group flex ${isUser ? "justify-end" : "justify-start"} w-full relative`}
    >
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white rounded-tr-sm"
            : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm",
        ].join(" ")}
      >
        {msg.pending && msg.content === "" ? (
          <TypingDots />
        ) : (
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        )}

        {msg.cards && msg.cards.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.cards.map((card, i) => (
              <RichCardView key={i} card={card} />
            ))}
          </div>
        )}

        {msg.actions && msg.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {msg.actions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={a.exec}
                className={
                  isUser
                    ? "text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 text-white hover:bg-white/30 transition"
                    : "text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                }
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Speak button — re-leer mensaje en voz alta (hover-reveal). */}
      {showSpeak && onSpeak && onStopSpeak && (
        <div className="absolute -bottom-1 left-12 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <SpeakMessageButton
            text={msg.content}
            isSpeaking={isSpeakingThis}
            onSpeak={onSpeak}
            onStop={onStopSpeak}
          />
        </div>
      )}
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span
      role="status"
      aria-label="Aria está escribiendo"
      className="inline-flex items-center gap-1 py-1"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </span>
  );
}

function RichCardView({ card }: { card: RichCard }) {
  if (card.kind === "kpis") {
    const k = card.data;
    return (
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-cyan-50 border border-indigo-100 p-3">
        <p className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider mb-1">
          KPIs · {k.period}
        </p>
        <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
          <NumberFlow value={k.cotizaciones} /> cotizaciones
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-700">
          <div>
            <span className="text-slate-500">Monto total:</span>{" "}
            <span className="font-bold">{formatMxnShort(k.montoTotal)}</span>
          </div>
          <div>
            <span className="text-slate-500">Ticket prom.:</span>{" "}
            <span className="font-bold">
              {formatMxnShort(k.ticketPromedio)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">A/B:</span>{" "}
            <span className="font-bold">{k.abPromedio}%</span>
          </div>
          <div>
            <span className="text-slate-500">Clientes:</span>{" "}
            <span className="font-bold">{k.clientesActivos}</span>
          </div>
        </div>
      </div>
    );
  }
  if (card.kind === "cotizaciones") {
    return (
      <div className="space-y-1.5">
        {card.data.slice(0, 5).map((c) => (
          <div
            key={c.id}
            className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-cyan-700 font-bold">
                {c.folio || "—"}
              </p>
              <p className="text-xs text-slate-700 truncate">
                {c.rfc || "Sin RFC"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                {formatMxnShort(c.monto || 0)}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                {c.estado || "—"}
              </p>
            </div>
          </div>
        ))}
        {card.data.length > 5 && (
          <p className="text-[11px] text-slate-500 text-center">
            +{card.data.length - 5} más
          </p>
        )}
      </div>
    );
  }
  // clientes
  return (
    <div className="space-y-1.5">
      {card.data.slice(0, 5).map((c, i) => (
        <div
          key={c.rfc || i}
          className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex items-center gap-2.5"
        >
          <div
            aria-hidden="true"
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 text-white text-[10px] font-bold flex items-center justify-center shrink-0"
          >
            {(c.rfc || "??").slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 truncate">
              {c.razon_social || c.rfc || "Cliente"}
            </p>
            <p className="text-[11px] font-mono text-slate-500">{c.rfc}</p>
          </div>
          {typeof c.cotizaciones === "number" && (
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5">
              {c.cotizaciones}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
