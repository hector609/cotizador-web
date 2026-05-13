import { expect, test } from "@playwright/test";

/**
 * Smoke /signup — formulario de alta de distribuidor + visual del lado
 * derecho. El backend `/api/signup` puede rate-limitar agresivamente: este
 * test NO envía un payload válido (intencionalmente vacío + sin aceptar
 * términos) para evitar crear leads basura en producción.
 */
test.describe("Signup /signup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("form fields visibles", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: /Crear cuenta/i }),
    ).toBeVisible();

    await expect(page.getByLabel(/Email de contacto/i)).toBeVisible();
    await expect(page.getByLabel(/RFC de la empresa/i)).toBeVisible();
    await expect(page.getByLabel(/Nombre del distribuidor/i)).toBeVisible();
    // Teléfono y Telegram también existen — basta con afirmar 2 más para
    // detectar que el form no se haya recortado.
    await expect(page.getByLabel(/Teléfono/i)).toBeVisible();
    await expect(page.getByLabel(/Telegram/i)).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Enviar solicitud/i }),
    ).toBeVisible();
  });

  test("submit vacío sin aceptar términos → error", async ({ page }) => {
    // Click directo en submit con todos los campos vacíos y términos sin
    // aceptar. El handler valida `acceptedTerms` antes que la red, así que
    // jamás llegamos al fetch.
    //
    // Nota: los <input required> de HTML5 mostrarán el tooltip nativo del
    // navegador que NO es role=alert. Para evitar que el browser pre-empte el
    // submit, marcamos el form como noValidate (ya lo está) y forzamos fill
    // de un email válido — así el primer fallo es el de términos.
    await page.getByLabel(/Email de contacto/i).fill("e2e@example.com");
    await page.getByLabel(/RFC de la empresa/i).fill("ABC123456XY7");
    await page.getByLabel(/Nombre del distribuidor/i).fill("Distribuidor E2E");
    await page.getByLabel(/Teléfono/i).fill("5512345678");

    await page.getByRole("button", { name: /Enviar solicitud/i }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 5_000 });
    // Mensaje exacto del handler en page.tsx L110-112.
    await expect(alert).toContainText(/términos|terminos/i);
  });

  test("right pane visual visible con value-prop", async ({ page }) => {
    // El SignupVisual incluye chips de valor concretas: "Cotización completada",
    // folio #2378845, "PDF cliente", "PDF interno". Validamos 2 anchors únicos.
    await expect(page.getByText(/Cotización completada/i)).toBeVisible();
    await expect(page.getByText("PDF cliente", { exact: true })).toBeVisible();
  });
});
