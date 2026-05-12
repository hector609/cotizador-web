"use client";

/**
 * useChatCotizar — hook que encapsula el flujo conversacional de cotización.
 *
 * Ciclo de vida:
 *   1. Usuario escribe → sendMessage(text)
 *   2. Hook hace POST /api/chat/cotizar con { conversation_id?, message }.
 *      - 200 status=ask  → siguiente pregunta del agente.
 *      - 200 status=validation_error → error legible (se inserta como mensaje
 *        del agente, NO bloquea la conversación).
 *      - 202 status=started → arranca polling a /api/cotizaciones/{job_id}
 *        cada POLL_INTERVAL_MS.
 *      - 429 → mensaje "Espera N segundos" + bloqueo de input por retry_after.
 *      - 503 → mensaje "Agente no disponible" + permitir reintento manual.
 *
 *   3. Polling: cada 3s GET /api/cotizaciones/{id}
 *      - estado=completada → guarda pdf_url, finaliza.
 *      - estado=fallida    → muestra error, ofrece reiniciar.
 *      - timeout 6 min     → corta polling, ofrece reiniciar.
 *
 *   4. cancelJob → DELETE /api/cotizaciones/{id} y limpia state.
 *
 * Persistencia: `conversation_id` se guarda en sessionStorage para sobrevivir
 * refrescos del tab. El historial de mensajes NO se persiste — al refrescar
 * el usuario recibirá el saludo inicial otra vez (el backend Claude tiene
 * memoria de la conversación, así que retomará donde quedó).
 */

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 6 * 60 * 1_000;
const STORAGE_KEY_CONVERSATION = "chat-cotizar:conversation_id";

/**
 * Fire-and-forget para telemetría (chat vs Excel). El owner quiere validar
 * con datos reales que el chat reemplazó al Wizard antes de matar
 * permanentemente el path Excel. NUNCA bloquea el flow ni propaga errores.
 */
function fireTelemetry(source: "chat"): void {
  try {
    void fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "cotizacion_iniciada",
        source,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }).catch(() => {
      // Silencio total: telemetría nunca rompe UX.
    });
  } catch {
    // Algunos navegadores podrían tirar sync; tampoco propagamos.
  }
}

export type ChatRole = "user" | "agent" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
}

export type JobState =
  | { kind: "idle" }
  | { kind: "starting"; rfc?: string; reasoning?: string }
  | { kind: "polling"; id: string; rfc?: string; startedAt: number }
  | { kind: "completed"; id: string; pdfUrl?: string }
  | { kind: "failed"; id?: string; message: string };

interface ChatAskResponse {
  status: "ask";
  conversation_id: string;
  message: string;
}

interface ChatValidationErrorResponse {
  status: "validation_error";
  conversation_id: string;
  message: string;
}

interface ChatStartedResponse {
  status: "started";
  job_id: string;
  estado: string;
  message?: string;
  rfc?: string;
}

interface ChatErrorResponse {
  error: string;
  retry_after?: number;
}

interface CotizacionPollResponse {
  cotizacion: {
    id: string;
    estado: "pendiente" | "completada" | "fallida";
    pdf_url?: string;
    error?: string;
  };
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredConversationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY_CONVERSATION);
  } catch {
    return null;
  }
}

function writeStoredConversationId(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY_CONVERSATION, value);
    else window.sessionStorage.removeItem(STORAGE_KEY_CONVERSATION);
  } catch {
    // sessionStorage puede estar deshabilitado (modo incógnito estricto).
  }
}

export interface UseChatCotizarResult {
  messages: ChatMessage[];
  /** true mientras esperamos respuesta del endpoint /api/chat/cotizar. */
  sending: boolean;
  /** Estado del job de cotización (idle | starting | polling | completed | failed). */
  job: JobState;
  /** Segundos restantes de rate-limit; 0 si no aplica. */
  rateLimitedFor: number;
  /** Envía un mensaje del usuario al agente. */
  sendMessage: (text: string) => Promise<void>;
  /** Cancela el job activo (DELETE /api/cotizaciones/{id}). */
  cancelJob: () => Promise<void>;
  /** Resetea TODO: historial, conversation_id, job. Útil tras error fatal. */
  resetChat: () => void;
  /** true si el input debe estar deshabilitado (sending, polling, rate-limit). */
  inputDisabled: boolean;
}

const GREETING: ChatMessage = {
  id: "greeting",
  role: "agent",
  text:
    "Hola. Cuéntame qué cotización necesitas: cliente (RFC si lo tienes), cuántas líneas, qué equipos y qué plan. Puedo ir preguntando lo que falte.",
  createdAt: Date.now(),
};

export function useChatCotizar(): UseChatCotizarResult {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [sending, setSending] = useState(false);
  const [job, setJob] = useState<JobState>({ kind: "idle" });
  const [rateLimitedFor, setRateLimitedFor] = useState(0);

  // Refs para evitar stale closures en intervals/timeouts.
  const conversationIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rateLimitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hidratar conversation_id desde sessionStorage al montar.
  useEffect(() => {
    const stored = readStoredConversationId();
    if (stored) conversationIdRef.current = stored;
  }, []);

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const clearRateLimit = useCallback(() => {
    if (rateLimitIntervalRef.current) {
      clearInterval(rateLimitIntervalRef.current);
      rateLimitIntervalRef.current = null;
    }
    setRateLimitedFor(0);
  }, []);

  // Cleanup al desmontar.
  useEffect(() => {
    return () => {
      clearPolling();
      clearRateLimit();
    };
  }, [clearPolling, clearRateLimit]);

  const appendMessage = useCallback(
    (role: ChatRole, text: string) => {
      setMessages((prev) => [
        ...prev,
        { id: randomId(), role, text, createdAt: Date.now() },
      ]);
    },
    [],
  );

  const startRateLimitCountdown = useCallback(
    (seconds: number) => {
      clearRateLimit();
      const safe = Math.max(1, Math.min(300, Math.floor(seconds)));
      setRateLimitedFor(safe);
      rateLimitIntervalRef.current = setInterval(() => {
        setRateLimitedFor((prev) => {
          if (prev <= 1) {
            if (rateLimitIntervalRef.current) {
              clearInterval(rateLimitIntervalRef.current);
              rateLimitIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1_000);
    },
    [clearRateLimit],
  );

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(
          `/api/cotizaciones/${encodeURIComponent(jobId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          // No detenemos el polling por errores transitorios; sí por 404.
          if (res.status === 404) {
            clearPolling();
            setJob({
              kind: "failed",
              id: jobId,
              message: "Cotización no encontrada.",
            });
            appendMessage(
              "system",
              "No pudimos encontrar tu cotización. Empieza de nuevo.",
            );
          }
          return;
        }
        const data = (await res.json()) as CotizacionPollResponse;
        const c = data.cotizacion;
        if (c.estado === "completada") {
          clearPolling();
          setJob({ kind: "completed", id: c.id, pdfUrl: c.pdf_url });
          appendMessage(
            "agent",
            c.pdf_url
              ? "Listo. Tu cotización está abajo, puedes descargarla."
              : "Listo. La cotización terminó pero no recibimos el enlace al PDF; revísala en Historial.",
          );
        } else if (c.estado === "fallida") {
          clearPolling();
          const msg =
            c.error && c.error.length < 300
              ? c.error
              : "La cotización falló en el portal del operador.";
          setJob({ kind: "failed", id: c.id, message: msg });
          appendMessage("agent", `No pude completar la cotización: ${msg}`);
        }
        // estado=pendiente → seguimos pollando.
      } catch (e) {
        console.error("[useChatCotizar] poll error", e);
        // Errores de red: dejamos que el siguiente tick reintente.
      }
    },
    [appendMessage, clearPolling],
  );

  const startPolling = useCallback(
    (jobId: string, rfc?: string) => {
      clearPolling();
      const startedAt = Date.now();
      setJob({ kind: "polling", id: jobId, rfc, startedAt });
      // Primer tick inmediato (no esperar 3s para mostrar feedback).
      void pollJob(jobId);
      pollIntervalRef.current = setInterval(() => {
        void pollJob(jobId);
      }, POLL_INTERVAL_MS);
      pollTimeoutRef.current = setTimeout(() => {
        clearPolling();
        setJob({
          kind: "failed",
          id: jobId,
          message:
            "La cotización tardó más de 6 minutos. Probablemente sigue corriendo; revisa Historial.",
        });
        appendMessage(
          "agent",
          "Se acabó el tiempo de espera. La cotización podría seguir corriendo — revisa la sección Historial en unos minutos.",
        );
      }, POLL_TIMEOUT_MS);
    },
    [appendMessage, clearPolling, pollJob],
  );

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sending || rateLimitedFor > 0) return;
      if (job.kind === "polling" || job.kind === "starting") return;

      appendMessage("user", text);
      setSending(true);

      try {
        const payload: Record<string, unknown> = { message: text };
        if (conversationIdRef.current) {
          payload.conversation_id = conversationIdRef.current;
        }

        const res = await fetch("/api/chat/cotizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 401 || res.status === 403) {
          appendMessage(
            "system",
            "Tu sesión expiró. Recarga la página o vuelve a entrar.",
          );
          return;
        }
        if (res.status === 429) {
          let retryAfter = 30;
          try {
            const data = (await res.json()) as ChatErrorResponse;
            if (typeof data.retry_after === "number") retryAfter = data.retry_after;
          } catch {
            // ignore
          }
          appendMessage(
            "system",
            `Estás enviando muchos mensajes. Espera ${retryAfter}s antes de intentar de nuevo.`,
          );
          startRateLimitCountdown(retryAfter);
          return;
        }
        if (res.status === 503) {
          appendMessage(
            "system",
            "El agente no está disponible ahora. Intenta de nuevo en un minuto.",
          );
          return;
        }
        if (!res.ok) {
          let msg = "Error en el servidor.";
          try {
            const data = (await res.json()) as ChatErrorResponse;
            if (typeof data.error === "string" && data.error.length < 200) {
              msg = data.error;
            }
          } catch {
            // ignore
          }
          appendMessage("system", msg);
          return;
        }

        const data = (await res.json()) as
          | ChatAskResponse
          | ChatValidationErrorResponse
          | ChatStartedResponse;

        if (data.status === "ask") {
          conversationIdRef.current = data.conversation_id;
          writeStoredConversationId(data.conversation_id);
          appendMessage("agent", data.message);
          return;
        }
        if (data.status === "validation_error") {
          conversationIdRef.current = data.conversation_id;
          writeStoredConversationId(data.conversation_id);
          appendMessage("agent", data.message);
          return;
        }
        if (data.status === "started") {
          // El agente ya tiene todo: arrancar polling.
          // Antes del polling lanzamos telemetría (fire-and-forget) para
          // medir "chat vs excel" — si Vercel logs muestra 100% chat / 0%
          // excel en N días, podemos eliminar el path Excel.
          fireTelemetry("chat");
          setJob({
            kind: "starting",
            rfc: data.rfc,
            reasoning: data.message,
          });
          if (data.message) appendMessage("agent", data.message);
          appendMessage(
            "agent",
            "Estoy generando la cotización contra el portal de Telcel. Esto tarda 3-5 minutos.",
          );
          startPolling(data.job_id, data.rfc);
          return;
        }
        // Shape inesperado: avisamos sin romper.
        appendMessage(
          "system",
          "Recibí una respuesta inesperada del agente. Intenta de nuevo.",
        );
      } catch (e) {
        console.error("[useChatCotizar] sendMessage error", e);
        appendMessage(
          "system",
          "No pude contactar al servidor. Revisa tu conexión e intenta de nuevo.",
        );
      } finally {
        setSending(false);
      }
    },
    [
      sending,
      rateLimitedFor,
      job.kind,
      appendMessage,
      startRateLimitCountdown,
      startPolling,
    ],
  );

  const cancelJob = useCallback(async () => {
    if (job.kind !== "polling") return;
    const jobId = job.id;
    clearPolling();
    setJob({ kind: "idle" });
    appendMessage("system", "Cotización cancelada.");
    try {
      await fetch(`/api/cotizaciones/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error("[useChatCotizar] cancel error", e);
      // No notificamos al usuario — el job ya está oculto en su UI.
    }
  }, [job, clearPolling, appendMessage]);

  const resetChat = useCallback(() => {
    clearPolling();
    clearRateLimit();
    conversationIdRef.current = null;
    writeStoredConversationId(null);
    setMessages([{ ...GREETING, id: "greeting-" + randomId(), createdAt: Date.now() }]);
    setJob({ kind: "idle" });
    setSending(false);
  }, [clearPolling, clearRateLimit]);

  const inputDisabled =
    sending ||
    rateLimitedFor > 0 ||
    job.kind === "polling" ||
    job.kind === "starting";

  return {
    messages,
    sending,
    job,
    rateLimitedFor,
    sendMessage,
    cancelJob,
    resetChat,
    inputDisabled,
  };
}
