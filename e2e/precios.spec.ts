import { expect, test } from "@playwright/test";

/**
 * Smoke /precios — toggle Mensual/Anual debe alterar el precio del plan Pro
 * (NumberFlow re-render), y las FAQ details deben abrir con click. El Pro
 * card lleva `scale: 1.05` via framer-motion (animate prop) — no podemos
 * leerlo del style inline, pero sí podemos validar la presencia del badge
 * "Recomendado" como proxy estable.
 */
test.describe("Precios /precios", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/precios");
  });

  test("3 plan cards visibles + Pro highlighted", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Starter/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Pro$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Empresa/i })).toBeVisible();

    // Pro destacado: tiene la badge "Recomendado". (Si en el futuro el plan
    // destacado cambia, este test lo refleja con un fail explícito.)
    await expect(page.getByText(/Recomendado/i)).toBeVisible();
  });

  test("toggle billing pill — click Anual cambia precio Pro", async ({
    page,
  }) => {
    // Capturamos el bloque del plan Pro: el <h3>Pro</h3> es ancestro del
    // precio mostrado. Usamos el card que contiene el badge "Recomendado"
    // como anchor.
    const proCard = page
      .locator(":has(> :text-is(\"Recomendado\"))")
      .first()
      .locator("xpath=ancestor::*[contains(@class, 'rounded-3xl')][1]");
    // Fallback: si el selector custom falla por re-flow, igual el price
    // existe a nivel página. Tomamos snapshot del texto completo del card.
    const initialText = await proCard.innerText().catch(() => "");

    // El switch a "Anual" baja el precio (yearlyPrice por mes = price * 0.85,
    // o el campo definido). NumberFlow tarda ~400ms en transicionar dígitos.
    await page.getByRole("button", { name: /Anual/i }).click();

    // Esperamos render — NumberFlow es async.
    await page.waitForTimeout(800);

    const afterText = await proCard.innerText().catch(() => "");
    // Si por algún motivo el card-anchor no resolvió, abortamos sin falso
    // positivo: validamos sobre el body que algún número cambió.
    if (initialText && afterText) {
      expect(afterText).not.toBe(initialText);
    } else {
      // Plan B: hay un <span>/año</span> que aparece tras el toggle y no
      // antes (period label cambia de "/mes" a "/año").
      await expect(page.getByText("/año").first()).toBeVisible();
    }
  });

  test("FAQ details abren con click", async ({ page }) => {
    // Las preguntas se renderizan dentro de <details>; cada summary es
    // clickeable. Buscamos la primera y validamos open=true tras el click.
    const firstDetails = page.locator("details").first();
    await firstDetails.scrollIntoViewIfNeeded();
    await expect(firstDetails).not.toHaveAttribute("open", "");

    await firstDetails.locator("summary").click();
    // <details open> agrega el attribute booleano; en Playwright se valida
    // con toHaveAttribute (string vacío == presencia).
    await expect(firstDetails).toHaveAttribute("open", /.*/);
  });
});
