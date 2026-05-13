import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for cotizador-web.
 *
 * Goals:
 *   - Smoke tests on the 5 critical public surfaces: landing, /login, /signup,
 *     /precios y el guard de /dashboard.
 *   - NO disparar cotizaciones reales — eso lo cubre el synthetic monitor del
 *     bot (`/veredicto` + `/cot`). Aquí solo verificamos UI/redirects.
 *
 * Local:    `npm run test:e2e`  (asume `npm run dev` corriendo en :3000)
 * CI:       el workflow levanta `npm start` y espera a localhost:3000 antes.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e-results",
  // Cada test ~10s en local; damos margen para CI lento.
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Solo retry en CI — local debe pasar a la primera o tenemos un bug real.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: process.env.CI
    ? [["html", { outputFolder: "playwright-report", open: "never" }], ["line"]]
    : [["html", { outputFolder: "playwright-report", open: "never" }], ["line"]],

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Mexico locale — varios textos esperan "$" como prefijo (Intl.NumberFormat).
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    // Mobile project — opcional, descomentar si se quiere validar también el
    // breakpoint < lg donde el right pane de login/signup desaparece.
    // {
    //   name: "chromium-mobile",
    //   use: { ...devices["Pixel 7"] },
    // },
  ],

  // No usamos webServer aquí — preferimos dejar al CI/dev hacer el `npm start`
  // explícito. Evita race conditions con Next.js compilando bajo demanda en
  // primera request, que tira los tests con timeouts engañosos.
});
