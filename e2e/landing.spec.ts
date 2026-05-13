import { expect, test } from "@playwright/test";

/**
 * Smoke landing — verifica que `/` no regrese a un estado roto post-deploy.
 *
 * Cosas que NO testeamos a propósito:
 *   - Recharts SVG interno (es animación, flake garantizado).
 *   - ConciergeWidget (depende de Anthropic API key, mejor mockear o saltarse).
 *   - Mac mockup chips desktop-only sin breakpoint test dedicado.
 */
test.describe("Landing /", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero H1 + CTA principal", async ({ page }) => {
    // H1 contiene "Cotiza Telcel" partido por <span>; usar getByRole regex.
    const h1 = page.getByRole("heading", { level: 1, name: /Cotiza Telcel/i });
    await expect(h1).toBeVisible();

    // Top-nav CTA "Probar gratis" → /signup (hay otro CTA "Comenzar ahora" en
    // hero también a /signup; basta con verificar el del nav porque es el que
    // siempre debe estar visible above-the-fold).
    const ctaProbar = page.getByRole("link", { name: /Probar gratis/i }).first();
    await expect(ctaProbar).toBeVisible();
    await expect(ctaProbar).toHaveAttribute("href", "/signup");
  });

  test("floating shapes — al menos 3 blur-3xl visibles", async ({ page }) => {
    // FloatingBlob renders motion.div con `rounded-full blur-3xl`.
    // Hay 5 en hero + 1+1 en otras secciones; afirmamos >=3 para no acoplarnos
    // al número exacto.
    const blobs = page.locator(".blur-3xl");
    await expect(blobs.first()).toBeAttached();
    expect(await blobs.count()).toBeGreaterThanOrEqual(3);
  });

  test("stats band renders con NumberFlow", async ({ page }) => {
    // El label "Promedio en producción" precede al grid de 4 stats.
    await expect(page.getByText(/Promedio en producción/i)).toBeVisible();

    // El stat "Min. promedio" tiene un display override "2:14" (no NumberFlow,
    // hardcoded en JSX). Lo usamos como anchor estable.
    await expect(page.getByText("2:14", { exact: true })).toBeVisible();

    // "+ Margen B2B" sí pasa por NumberFlow (renderiza spans con dígitos
    // animados); verificamos el label porque el número puede aparecer en
    // múltiples slots (chip flotante 18.4%, tabla mock). El label es único.
    await expect(page.getByText(/\+\s*Margen B2B/i)).toBeVisible();
  });

  test("pricing teaser — 3 plan cards", async ({ page }) => {
    const pricing = page.locator("#pricing");
    await pricing.scrollIntoViewIfNeeded();
    await expect(pricing.getByText("Starter", { exact: true })).toBeVisible();
    await expect(pricing.getByText("Pro", { exact: true })).toBeVisible();
    await expect(pricing.getByText("Business", { exact: true })).toBeVisible();

    // El recomendado (Pro) tiene la badge "Recomendado".
    await expect(pricing.getByText(/Recomendado/i)).toBeVisible();
  });

  test("footer visible al scroll bottom", async ({ page }) => {
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/© 2026 Hectoria/i)).toBeVisible();
  });
});
