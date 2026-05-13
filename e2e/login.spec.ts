import { expect, test } from "@playwright/test";

/**
 * Smoke /login — el form de email + password debe quedar usable aun si el
 * widget de Telegram cae (script externo, bloqueable por uBlock). Y los errores
 * del backend deben surfacear como role=alert.
 */
test.describe("Login /login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("form fields email + password visibles", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: /Iniciar sesión/i }),
    ).toBeVisible();

    // useId() genera ids dinámicos; usamos label-association (htmlFor).
    const email = page.getByLabel(/Correo electrónico/i);
    const password = page.getByLabel(/Contraseña/i);
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute("type", "email");
    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute("type", "password");

    await expect(
      page.getByRole("button", { name: /Ingresar al portal/i }),
    ).toBeVisible();
  });

  test("submit con credenciales inválidas → role=alert visible", async ({
    page,
  }) => {
    // Llenamos con un valor válido como email (HTML5 required no nos bloquee)
    // pero garantizado a no existir. El backend responde !ok y el handler
    // friendlyAuthError() pinta el mensaje en role=alert.
    await page.getByLabel(/Correo electrónico/i).fill("e2e-noexiste@example.com");
    await page.getByLabel(/Contraseña/i).fill("contrasena-invalida-e2e");

    await page.getByRole("button", { name: /Ingresar al portal/i }).click();

    // El backend puede tardar; el alert aparece tras await setError.
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 10_000 });
    // Mensaje del friendlyAuthError mexicano para credenciales malas.
    await expect(alert).toContainText(/credencial|no coinciden|conectar/i);
  });

  test("right pane mockup card visible en viewport desktop", async ({
    page,
  }) => {
    // El aside derecho está `aria-hidden` + `hidden lg:flex`, por lo que solo
    // existe en DOM con visibilidad real arriba de 1024px (default desktop).
    // El mockup tiene la pill "Cotización completada" como texto único.
    await expect(page.getByText(/Cotización completada/i)).toBeVisible();
    // El folio 2378845 aparece tanto en mockup como (potencialmente) en otros
    // lados — primero match estabiliza.
    await expect(page.getByText("#2378845").first()).toBeVisible();
  });

  test("trust pills visibles", async ({ page }) => {
    await expect(page.getByText("Datos en México", { exact: true })).toBeVisible();
    await expect(page.getByText("Cifrado E2E", { exact: true })).toBeVisible();
    await expect(page.getByText("Logs auditables", { exact: true })).toBeVisible();
  });
});
