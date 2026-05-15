/**
 * centinela-report.ts — cliente para reportar errores al backend Centinela.
 * Best-effort: si falla, console.warn pero NO bloquea UX.
 * Throttle: máx 5 reports/min.
 */

interface ErrorReport {
  source: "web";
  route: string;
  error_message: string;
  stack?: string;
  digest?: string;
}

let reportCount = 0;
let lastResetTime = Date.now();

function isThrottled(): boolean {
  const now = Date.now();
  if (now - lastResetTime > 60000) {
    reportCount = 0;
    lastResetTime = now;
  }
  return reportCount >= 5;
}

export async function reportError(error: Partial<ErrorReport>): Promise<void> {
  // Cliente-side only
  if (typeof window === "undefined") return;

  if (isThrottled()) {
    console.warn("[Centinela] throttled: max 5 reports/min");
    return;
  }

  const payload: ErrorReport = {
    source: "web",
    route: error.route || window.location.pathname,
    error_message: error.error_message || error.digest || "unknown error",
    stack: error.stack,
    digest: error.digest,
  };

  reportCount++;

  try {
    const response = await fetch("/api/centinela/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // best-effort si la página se cierra
    });

    if (!response.ok) {
      console.warn(`[Centinela] HTTP ${response.status}`);
    }
  } catch (err) {
    // best-effort: nunca bloquea UX
    console.warn("[Centinela] fetch failed:", err);
  }
}
