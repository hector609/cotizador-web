"use client";

/**
 * /dashboard/mis-links — Panel "Mis Links" (G-1 Lead Capture).
 *
 * LUMINA Light Premium:
 *  - bg-slate-50 + cards bg-white rounded-2xl border-slate-200
 *  - Indigo #4F46E5 / Cyan #06B6D4 / Pink #EC4899
 *  - framer-motion fade-up en cards y modal
 *  - Toast nativo (sin sonner — no está en package.json). Usa un pequeño
 *    componente <Toast> propio al pie del viewport.
 *  - Filtros: activos / expirados / agotados
 *  - Plan gating: si el backend devuelve 403 → pantalla upsell
 *  - Sidebar: componente Sidebar de admin/Sidebar.tsx (mismo que clientes)
 *
 * ANTI-COLISIÓN: No toca app/onboarding/*, app/p/*, src/lib/onboardingApi.ts,
 * ni src/lib/publicLinkApi.ts.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  Plus,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  X,
  Loader2,
} from "lucide-react";
import { Sidebar } from "@/components/admin/Sidebar";
import { TrialBanner } from "@/components/admin/TrialBanner";
import {
  listLinks,
  createLink,
  getLinkStatus,
  type PublicLink,
  type LinkStatus,
} from "@/lib/myLinksApi";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Tipos de filtro                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

type FilterKey = "todos" | LinkStatus;

const FILTER_LABELS: Record<FilterKey, string> = {
  todos: "Todos",
  activo: "Activos",
  expirado: "Expirados",
  agotado: "Agotados",
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers de formato                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtDateRelative(iso: string): string {
  try {
    const diff = new Date(iso).getTime() - Date.now();
    const days = Math.ceil(diff / 86_400_000);
    if (days < 0) return "Expiró";
    if (days === 0) return "Hoy";
    if (days === 1) return "Mañana";
    return `${days} días`;
  } catch {
    return "—";
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Mini toast nativo                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

interface ToastMsg {
  id: number;
  text: string;
  type: "success" | "error";
}

let _toastCounter = 0;

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const show = useCallback((text: string, type: "success" | "error" = "success") => {
    const id = ++_toastCounter;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return { toasts, show };
}

function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            role="status"
            className={[
              "px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold pointer-events-auto border",
              t.type === "success"
                ? "bg-white border-emerald-200 text-emerald-800"
                : "bg-white border-rose-200 text-rose-700",
            ].join(" ")}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Badge de estado                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<LinkStatus, string> = {
  activo:
    "text-emerald-700 bg-emerald-50 border-emerald-200",
  expirado:
    "text-slate-500 bg-slate-100 border-slate-200",
  agotado:
    "text-amber-700 bg-amber-50 border-amber-200",
};

const STATUS_LABELS_UI: Record<LinkStatus, string> = {
  activo: "Activo",
  expirado: "Expirado",
  agotado: "Agotado",
};

function StatusBadge({ status }: { status: LinkStatus }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border",
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {status === "activo" && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
      )}
      {STATUS_LABELS_UI[status]}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Card de link individual                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function LinkCard({
  link,
  delayIndex,
  onCopy,
}: {
  link: PublicLink;
  delayIndex: number;
  onCopy: (url: string) => void;
}) {
  const status = getLinkStatus(link);
  const isActive = status === "activo";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay: Math.min(delayIndex, 12) * 0.03,
      }}
      whileHover={isActive ? { y: -3, scale: 1.015 } : undefined}
      className={[
        "rounded-2xl bg-white border shadow-sm transition-shadow",
        isActive
          ? "border-slate-200 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/40"
          : "border-slate-200 opacity-75",
      ].join(" ")}
    >
      <div className="p-5">
        {/* Header: slug + badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-base font-extrabold text-slate-900 tracking-wider">
              {link.slug}
            </span>
            <StatusBadge status={status} />
          </div>
          {/* Botón copiar URL */}
          {isActive && (
            <CopyButton
              url={link.public_url}
              onCopy={onCopy}
            />
          )}
        </div>

        {/* Email cliente (si existe) */}
        {link.cliente_email && (
          <p className="mt-2 text-xs text-slate-500">
            Para:{" "}
            <span className="font-medium text-slate-700">{link.cliente_email}</span>
          </p>
        )}

        {/* Stats grid */}
        <dl className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
              Usos
            </dt>
            <dd className="mt-0.5 font-bold text-slate-900 tabular-nums">
              {link.uses_count} / {link.max_uses}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
              Creado
            </dt>
            <dd className="mt-0.5 font-semibold text-slate-700">
              {fmtDate(link.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
              {isActive ? "Expira en" : "Expiró"}
            </dt>
            <dd
              className={[
                "mt-0.5 font-bold",
                isActive ? "text-indigo-600" : "text-slate-400",
              ].join(" ")}
            >
              {isActive ? fmtDateRelative(link.expires_at) : fmtDate(link.expires_at)}
            </dd>
          </div>
        </dl>

        {/* URL pública (solo en activos) */}
        {isActive && (
          <div className="mt-3 flex items-center gap-2">
            <p className="text-xs text-slate-400 truncate flex-1">{link.public_url}</p>
            <a
              href={link.public_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir link en nueva pestaña"
              className="shrink-0 text-slate-400 hover:text-indigo-600 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Botón copiar con feedback                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

function CopyButton({
  url,
  onCopy,
}: {
  url: string;
  onCopy: (url: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      onCopy(url);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "URL copiada" : "Copiar URL del link"}
      title={copied ? "Copiada" : "Copiar URL"}
      className={[
        "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
        copied
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50",
      ].join(" ")}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Modal "+ Nuevo Link"                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

interface NuevoLinkModalProps {
  onClose: () => void;
  onCreate: (slug: string, publicUrl: string) => void;
}

function NuevoLinkModal({ onClose, onCreate }: NuevoLinkModalProps) {
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState(7);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailId = useId();
  const maxUsesId = useId();
  const daysId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus trap: focus primer campo al montar.
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Cerrar con Escape.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await createLink({
        max_uses: maxUses,
        expires_in_days: days,
        ...(email.trim() ? { cliente_email: email.trim() } : {}),
      });
      onCreate(result.slug, result.public_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2
            id="modal-title"
            className="text-base font-bold text-slate-900"
          >
            Nuevo link de cotización
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-5">
            {/* Usos máximos */}
            <div>
              <label
                htmlFor={maxUsesId}
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Usos máximos
              </label>
              <input
                ref={firstInputRef}
                id={maxUsesId}
                type="number"
                min={1}
                max={100}
                value={maxUses}
                onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white transition"
              />
              <p className="mt-1 text-xs text-slate-400">
                Default 1 — el link se inhabilita tras el primer uso.
              </p>
            </div>

            {/* Días de vigencia */}
            <div>
              <label
                htmlFor={daysId}
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Vigencia (días)
              </label>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={[
                      "flex-1 py-2 rounded-xl text-sm font-semibold border transition-all",
                      days === d
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-400/20"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white",
                    ].join(" ")}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <input
                id={daysId}
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 7))}
                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white transition"
                aria-label="O escribe los días manualmente"
              />
            </div>

            {/* Email del cliente (opcional) */}
            <div>
              <label
                htmlFor={emailId}
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Email del cliente{" "}
                <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id={emailId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="compras@empresa.mx"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white transition"
              />
              <p className="mt-1 text-xs text-slate-400">
                Si se especifica, el link queda asociado a este cliente.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
              >
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:opacity-90 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando…
                </>
              ) : (
                "Crear link"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Pantalla upsell (plan starter)                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function UpsellScreen() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-3xl bg-white border border-slate-200 shadow-sm p-10 md:p-16 text-center max-w-lg mx-auto"
    >
      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center ring-8 ring-indigo-50/50">
        <Link2 className="w-9 h-9 text-indigo-500" />
      </div>
      <h2 className="mt-6 text-2xl font-extrabold text-slate-900 tracking-tight">
        Función disponible en plan Pro o Empresa
      </h2>
      <p className="mt-3 text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
        Los links de cotización G-1 te permiten enviar una URL personalizada por
        WhatsApp o email. Tu cliente llena sus datos en 30 segundos y recibe la
        propuesta automáticamente.
      </p>
      <div className="mt-8">
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:opacity-90 transition"
        >
          Ver planes
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Skeleton de carga                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

function SkeletonGrid() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando links…</span>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5"
          aria-hidden="true"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 bg-slate-100 rounded animate-pulse w-28" />
            <div className="h-6 bg-slate-100 rounded-full animate-pulse w-16" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="space-y-1">
                <div className="h-2 bg-slate-100 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Estado vacío                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function EmptyState({ onNewLink }: { onNewLink: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 md:p-14 text-center"
    >
      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center ring-8 ring-indigo-50/50">
        <Link2 className="w-10 h-10 text-indigo-500" />
      </div>
      <h2 className="mt-6 text-2xl font-extrabold text-slate-900 tracking-tight">
        Sin links todavía
      </h2>
      <p className="mt-2 text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
        Crea tu primer link de cotización y compártelo por WhatsApp o email.
        Tu cliente llena sus datos en 30 segundos y recibe la propuesta
        automáticamente.
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={onNewLink}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300/60 transition inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Crear primer link
        </button>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Página principal                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function MisLinksPage() {
  const [links, setLinks] = useState<PublicLink[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpsell, setIsUpsell] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [showModal, setShowModal] = useState(false);

  const { toasts, show: showToast } = useToast();
  const errorId = useId();

  /* ── Fetch ── */

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsUpsell(false);
    try {
      const data = await listLinks(1);
      setLinks(data.links ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar links.";
      // 403 → pantalla upsell
      if (msg.includes("403") || msg.toLowerCase().includes("plan")) {
        setIsUpsell(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  /* ── Filtrado client-side ── */

  const filtered = useMemo(() => {
    if (filter === "todos") return links;
    return links.filter((l) => getLinkStatus(l) === filter);
  }, [links, filter]);

  /* ── Contar por estado para los badges ── */

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      todos: links.length,
      activo: 0,
      expirado: 0,
      agotado: 0,
    };
    links.forEach((l) => {
      c[getLinkStatus(l)]++;
    });
    return c;
  }, [links]);

  /* ── Callback cuando el modal crea un link ── */

  function handleLinkCreated(slug: string, publicUrl: string) {
    setShowModal(false);
    showToast(`Link ${slug} creado. URL copiada al portapapeles.`);
    navigator.clipboard.writeText(publicUrl).catch(() => {
      /* silenciar error de permisos */
    });
    void loadLinks();
  }

  /* ── Copiar URL ── */

  function handleCopy(_url: string) {
    showToast("URL copiada al portapapeles.");
  }

  /* ── Render ── */

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar active="mis-links" />

      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <TrialBanner />
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <Link href="/dashboard" className="hover:text-indigo-600 transition">
              Inicio
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">Mis links</span>
          </div>

          {/* Header */}
          <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                Mis links
              </h1>
              <p className="mt-3 text-sm md:text-base text-slate-600 max-w-2xl">
                {isUpsell
                  ? "Crea links de cotización personalizados para tus clientes."
                  : total > 0
                  ? `${total} ${total === 1 ? "link creado" : "links creados"}.`
                  : "Links de cotización personalizados para tus clientes."}
              </p>
            </div>

            {/* Acciones */}
            {!isUpsell && (
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => void loadLinks()}
                  disabled={loading}
                  aria-label="Refrescar lista de links"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Cargando…" : "Refrescar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:opacity-90 transition"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo link
                </button>
              </div>
            )}
          </header>

          {/* Upsell */}
          {isUpsell ? (
            <UpsellScreen />
          ) : (
            <>
              {/* Error global */}
              {error && (
                <div
                  id={errorId}
                  role="alert"
                  className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-center justify-between gap-3 flex-wrap"
                >
                  <p className="text-rose-700 text-sm font-medium">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadLinks()}
                    className="px-3 py-1.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 text-sm font-medium hover:bg-rose-200 transition"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {/* Filtros */}
              {!loading && links.length > 0 && (
                <div
                  className="mb-6 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Filtrar links"
                >
                  {(["todos", "activo", "expirado", "agotado"] as FilterKey[]).map(
                    (key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        aria-pressed={filter === key}
                        className={[
                          "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all",
                          filter === key
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-400/20"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                        ].join(" ")}
                      >
                        {FILTER_LABELS[key]}
                        <span
                          className={[
                            "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                            filter === key
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-600",
                          ].join(" ")}
                        >
                          {counts[key]}
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Contenido */}
              {loading ? (
                <SkeletonGrid />
              ) : !error && links.length === 0 ? (
                <EmptyState onNewLink={() => setShowModal(true)} />
              ) : !error && filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center"
                >
                  <p className="text-slate-500 text-sm">
                    No hay links con estado{" "}
                    <span className="font-semibold">{FILTER_LABELS[filter].toLowerCase()}</span>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilter("todos")}
                    className="mt-3 text-indigo-600 text-sm font-semibold hover:underline"
                  >
                    Ver todos
                  </button>
                </motion.div>
              ) : !error ? (
                <ul
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  aria-label="Links de cotización"
                >
                  {filtered.map((link, idx) => (
                    <li key={link.slug}>
                      <LinkCard
                        link={link}
                        delayIndex={idx}
                        onCopy={handleCopy}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <NuevoLinkModal
            onClose={() => setShowModal(false)}
            onCreate={handleLinkCreated}
          />
        )}
      </AnimatePresence>

      {/* Toast container */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
