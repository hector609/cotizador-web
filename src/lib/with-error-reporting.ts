/**
 * with-error-reporting.ts — wrapper para server actions con captura de errores.
 * Captura excepción server-side → fetch a backend → re-throw para que Next handle UI.
 */

import crypto from "crypto";

async function reportServerError(
  route: string,
  errorMessage: string,
  stack?: string
): Promise<void> {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
    const sessionSecret = process.env.SESSION_SECRET || "dev-secret";

    const payload = JSON.stringify({
      source: "web",
      route,
      error_message: errorMessage,
      stack,
      digest: undefined,
      user_agent: "server-action",
    });

    const signature = crypto
      .createHmac("sha256", sessionSecret)
      .update(payload)
      .digest("hex");

    await fetch(`${backendUrl}/api/v1/centinela/report-error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth": `v1 ${signature}`,
      },
      body: payload,
    });
  } catch (err) {
    // best-effort: never block on error reporting
    console.warn("[server action error reporting] failed:", err);
  }
}

export async function withErrorReporting<T>(
  fn: () => Promise<T>,
  route?: string
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err) || "unknown error";
    const stack = err instanceof Error ? err.stack : undefined;

    // Report server-side
    await reportServerError(route || "server-action", errorMessage, stack);

    // Re-throw para que Next.js maneje el error UI
    throw err;
  }
}
