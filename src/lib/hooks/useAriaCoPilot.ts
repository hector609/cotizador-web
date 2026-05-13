"use client";

/**
 * useAriaCoPilot — observa el estado del chat /cotizar y pide sugerencias
 * contextuales a `/api/copilot/suggestions`.
 *
 * Diseño:
 *   - El hook NO modifica el state del chat ni el hook `useChatCotizar`.
 *   - Recibe un snapshot del state actual (rfc, plan, tramite, draft, lastAB,
 *     idleMs) por argumento y debounce-llama al endpoint cuando el snapshot
 *     cambia significativamente.
 *   - Mantiene la lista activa de suggestions; el caller puede `dismiss(id)`
 *     una sugerencia (la oculta hasta que cambie el snapshot al punto de
 *     re-trigger) y `apply(s)` para ejecutar la acción (el caller resuelve
 *     el callback_id contra su contexto — typically draft mutation, navigate
 *     o emitir un event).
 *
 * Triggers (gating del fetch):
 *   - Cambio de `rfc`, `plan`, `tramite`, `plazo`, `perfiles`, `lastABResult`.
 *   - Cambio de `draft` cuando se detecta RFC nuevo en el texto.
 *   - `idleMs` cruza el umbral 3min (poll cada minuto cuando idle).
 *
 *   Para evitar spam, debounce de 700ms y NUNCA refetch si los inputs
 *   "interesantes" no cambiaron (hash del snapshot relevante).
 *
 * Auth/rate-limit:
 *   - El endpoint maneja auth (cookie session). 401 → silenciamos (devolvemos
 *     []), no rompemos UX si la sesión expiró mid-cotización.
 *   - 429 → se ignora y se reintenta tras el próximo cambio (no insistimos).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AriaSuggestion } from "@/app/api/copilot/suggestions/route";

export type { AriaSuggestion } from "@/app/api/copilot/suggestions/route";

export interface AriaSnapshot {
  rfc?: string;
  perfiles?: number;
  plan?: string;
  tramite?: string;
  plazo?: number;
  draft?: string;
  /** Rentabilidad de la última cotización completada (% 0-100). null si no aplica. */
  lastABResult?: number | null;
  /** ms desde la última escritura en composer (lo calcula el padre). */
  idleMs?: number;
}

export interface UseAriaCoPilotResult {
  /** Lista de sugerencias activas (no dismissed). Ordenadas por relevancia (action > warn > info). */
  suggestions: AriaSuggestion[];
  /** true mientras hay un fetch en vuelo. */
  loading: boolean;
  /** true si el último fetch falló (rate-limited, network). NO se muestra al usuario, solo telemetría. */
  errored: boolean;
  /** Oculta una sugerencia por id hasta que cambie el snapshot al punto de re-trigger. */
  dismiss: (id: string) => void;
  /** Marca una sugerencia como "aplicada" (la dismissamos y notificamos al caller que ejecute la acción). */
  apply: (s: AriaSuggestion) => void;
}

const DEBOUNCE_MS = 700;

/**
 * Construye un hash estable de los campos "interesantes" del snapshot. Si
 * este hash NO cambia entre renders, NO refetcheamos. Esto evita spam al
 * endpoint si el padre re-renderiza por motivos no relacionados.
 */
function snapshotKey(snap: AriaSnapshot): string {
  const rfcInDraft = (() => {
    const txt = (snap.draft || "").toUpperCase();
    const m = txt.match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/);
    return m ? m[0] : "";
  })();
  // Buckets para idleMs: solo nos importa cruzar el umbral de 3min.
  const idleBucket =
    typeof snap.idleMs === "number" && snap.idleMs >= 3 * 60 * 1000 ? "idle" : "active";
  return [
    snap.rfc || rfcInDraft || "",
    snap.plan || "",
    snap.tramite || "",
    snap.plazo ?? "",
    snap.perfiles ?? "",
    snap.lastABResult ?? "",
    idleBucket,
  ].join("|");
}

const LEVEL_RANK: Record<AriaSuggestion["level"], number> = {
  action: 0,
  warn: 1,
  info: 2,
};

export function useAriaCoPilot(
  snapshot: AriaSnapshot,
  onApply?: (s: AriaSuggestion) => void,
): UseAriaCoPilotResult {
  const [suggestions, setSuggestions] = useState<AriaSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  // El key actual del snapshot. Si cambia → schedule fetch.
  const key = useMemo(() => snapshotKey(snapshot), [snapshot]);
  const lastFetchedKeyRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cuando cambia el key, reset dismissed (las suggestions previas ya no
  // aplican al nuevo contexto). Mantenemos dismissed para el MISMO key.
  useEffect(() => {
    if (key !== lastFetchedKeyRef.current) {
      setDismissed(new Set());
    }
  }, [key]);

  // Fetch debounced cuando el key cambia.
  useEffect(() => {
    if (key === lastFetchedKeyRef.current) return;
    // Si el snapshot está "vacío" (sin nada útil), no llamamos.
    const hasAnything =
      !!snapshot.rfc ||
      !!snapshot.plan ||
      !!snapshot.tramite ||
      typeof snapshot.lastABResult === "number" ||
      (snapshot.draft && snapshot.draft.trim().length > 10) ||
      (typeof snapshot.idleMs === "number" && snapshot.idleMs >= 3 * 60 * 1000);
    if (!hasAnything) {
      setSuggestions([]);
      lastFetchedKeyRef.current = key;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Cancela request anterior si la hubo.
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setErrored(false);
      try {
        const res = await fetch("/api/copilot/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
          credentials: "include",
          signal: ac.signal,
        });
        if (!res.ok) {
          setErrored(true);
          // Silenciamos suggestions previas si la sesión expiró.
          if (res.status === 401) setSuggestions([]);
          return;
        }
        const data = (await res.json()) as { suggestions?: AriaSuggestion[] };
        const list = Array.isArray(data.suggestions) ? data.suggestions : [];
        // Ordena por relevancia (action > warn > info).
        list.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
        setSuggestions(list);
        lastFetchedKeyRef.current = key;
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        setErrored(true);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [key, snapshot]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const apply = useCallback(
    (s: AriaSuggestion) => {
      // Dismissamos para que no quede colgada tras aplicar.
      dismiss(s.id);
      if (onApply) onApply(s);
    },
    [dismiss, onApply],
  );

  const visible = useMemo(
    () => suggestions.filter((s) => !dismissed.has(s.id)),
    [suggestions, dismissed],
  );

  return { suggestions: visible, loading, errored, dismiss, apply };
}
