import { expect, test } from "@playwright/test";

/**
 * Guard /dashboard — `getSession()` invoca `redirect("/login")` cuando no hay
 * cookie de sesión válida. Next.js traduce eso a un 307 server-side → la URL
 * final debe ser `/login`. Si alguien rompe el guard, el dashboard queda
 * expuesto y los datos de un tenant podrían leakear sin auth.
 */
test.describe("Guard /dashboard sin sesión", () => {
  test("acceso anónimo redirecta a /login", async ({ page, context }) => {
    // Limpiamos cookies por si acaso.
    await context.clearCookies();

    const response = await page.goto("/dashboard", {
      waitUntil: "domcontentloaded",
    });

    // El status final del response es 200 (porque el redirect lo siguió el
    // navegador hasta /login). Lo importante es la URL final.
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login(\?.*)?$/);

    // Y la página visible debe ser el login, no el dashboard.
    await expect(
      page.getByRole("heading", { level: 1, name: /Iniciar sesión/i }),
    ).toBeVisible();
  });
});
