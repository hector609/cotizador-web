/**
 * automate-pwabuilder-apk.mjs
 * Automatiza PWABuilder "Other Android" para generar APK sideloadable.
 * Uso: node scripts/automate-pwabuilder-apk.mjs
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec as execCb } from "child_process";

const exec = promisify(execCb);

const TARGET_URL = "https://cotizador.hectoria.mx";
const PWABUILDER_REPORT_URL = `https://www.pwabuilder.com/reportcard?site=${TARGET_URL}`;
const BASE_DIR = "C:/dev/cotizador-web";
const TMP_DIR = path.join(BASE_DIR, "tmp");
const PUBLIC_DIR = path.join(BASE_DIR, "public");
const TWA_DIR = path.join(BASE_DIR, "twa");
const APK_DEST = path.join(PUBLIC_DIR, "cotizador.apk");
const ZIP_DEST = path.join(TMP_DIR, "pwabuilder-package.zip");

for (const d of [TMP_DIR, TWA_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

let stepN = 0;
async function screenshot(page, label) {
  stepN++;
  const p = path.join(TMP_DIR, `pwabuilder-step-${stepN}-${label}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`[screenshot] ${p}`);
  return p;
}

async function failDump(page, step, msg) {
  const imgPath = path.join(TMP_DIR, `pwabuilder-fail-${step}.png`);
  const htmlPath = path.join(TMP_DIR, `pwabuilder-fail-${step}.html`);
  try {
    await page.screenshot({ path: imgPath, fullPage: false });
    fs.writeFileSync(htmlPath, await page.content());
  } catch (_) {}
  console.error(`\n[FALLO en paso "${step}"] ${msg}`);
  console.error(`  Screenshot: ${imgPath}`);
  process.exit(1);
}

async function main() {
  console.log("=== PWABuilder APK Automation v3 ===");
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Output: ${APK_DEST}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    args: ["--no-sandbox"],
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  // Interceptar requests para capturar la URL del API de Android
  let androidApiBaseUrl = null;
  let lastJobId = null;
  let zipBlob = null;
  const interceptedRequests = [];

  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("enqueuePackageJob") || url.includes("getPackageJob") || url.includes("downloadPackageZip")) {
      console.log(`  [network] Request: ${request.method()} ${url}`);
      interceptedRequests.push({ url, method: request.method() });
      if (url.includes("enqueuePackageJob")) {
        androidApiBaseUrl = url.replace(/\/enqueuePackageJob.*/, "");
        console.log(`  [network] Android API base URL: ${androidApiBaseUrl}`);
      }
      if (url.includes("downloadPackageZip")) {
        const idMatch = url.match(/id=([^&]+)/);
        if (idMatch) lastJobId = decodeURIComponent(idMatch[1]);
      }
    }
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("enqueuePackageJob")) {
      const status = response.status();
      console.log(`  [network] Response ${status} for enqueuePackageJob`);
      if (status === 200) {
        try {
          const body = await response.text();
          lastJobId = body.trim().replace(/"/g, "");
          console.log(`  [network] Job ID: ${lastJobId}`);
        } catch (_) {}
      } else {
        const errBody = await response.text().catch(() => "");
        console.log(`  [network] Error body: ${errBody.substring(0, 200)}`);
      }
    }
  });

  // ── PASO 1: Navegar directamente al reportcard ────────────────────────────
  console.log("[paso 1] Navegar a reportcard…");
  await page.goto(PWABUILDER_REPORT_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await screenshot(page, "reportcard-loaded");

  // ── PASO 2: Esperar que "Package For Stores" se habilite ──────────────────
  console.log("[paso 2] Esperando que el análisis complete (hasta 2 min)…");
  try {
    await page.waitForFunction(
      () => {
        // El botón puede estar en Shadow DOM — buscar recursivamente
        function find(root) {
          for (const el of root.querySelectorAll("button")) {
            if (/package for stores/i.test(el.textContent || "")) {
              return el;
            }
          }
          for (const el of root.querySelectorAll("*")) {
            if (el.shadowRoot) {
              const found = find(el.shadowRoot);
              if (found) return found;
            }
          }
          return null;
        }
        const btn = find(document);
        return btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true";
      },
      { timeout: 120000 }
    );
    console.log("  → Análisis completo.");
  } catch {
    await failDump(page, "analysis-timeout", "Package For Stores nunca se habilitó en 2 min.");
  }
  await screenshot(page, "analysis-complete");

  // ── PASO 3: Click "Package For Stores" ───────────────────────────────────
  console.log("[paso 3] Click 'Package For Stores'…");
  const pkgBtn = page.getByRole("button", { name: /package for stores/i });
  await pkgBtn.click({ force: true });
  await page.waitForTimeout(1500);
  await screenshot(page, "modal-platform-select");

  // ── PASO 4: Click "Generate Package" de Android (el segundo, no Windows) ──
  console.log("[paso 4] Click 'Generate Package' de Android…");
  // El modal muestra: Windows (btn 0), Android (btn 1), iOS (btn 2)
  // Esperar que el modal esté visible — buscar los botones Generate Package
  await page.waitForTimeout(1500); // modal animation

  const generateBtns = page.getByRole("button", { name: /generate package/i });
  // Esperar a que haya al menos 2 botones Generate Package
  try {
    await page.waitForFunction(
      () => document.querySelectorAll("button").length > 0 &&
            [...document.querySelectorAll("button")].filter(b => /generate package/i.test(b.textContent || "")).length >= 2,
      { timeout: 10000 }
    );
  } catch {
    // fallback: contar los que hay
  }

  const count = await generateBtns.count();
  console.log(`  → Generate Package buttons: ${count}`);

  await screenshot(page, "modal-with-generate-btns");

  if (count < 2) {
    await failDump(page, "android-generate-btn", `Solo ${count} botones 'Generate Package' — esperaba al menos 2 (Windows + Android).`);
  }

  // Posición 1 = Android (0=Windows, 1=Android, 2=iOS)
  await generateBtns.nth(1).click({ force: true });
  await page.waitForTimeout(2000);
  await screenshot(page, "android-form-opened");

  // ── PASO 5: Click tab "Other Android" ────────────────────────────────────
  console.log("[paso 5] Click tab 'Other Android'…");

  // Esperar el modal Android Package Options
  await page.waitForSelector("text=Android Package Options", { timeout: 10000 }).catch(() => {
    console.warn("  [warn] 'Android Package Options' no apareció — continuando...");
  });

  // Buscar y clickear el tab "Other Android"
  const otherAndroidTab = page.getByRole("tab", { name: /other android/i })
    .or(page.locator('text="Other Android"').filter({ has: page.locator('button, [role="tab"]') }))
    .or(page.locator('[data-value*="other"], [id*="other"]').filter({ hasText: /other android/i }))
    .first();

  // Intentar varios enfoques
  let tabClicked = false;

  // Intento 1: getByRole tab
  const tabByRole = page.getByRole("tab", { name: /other android/i });
  if (await tabByRole.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tabByRole.click();
    tabClicked = true;
    console.log("  → Tab via getByRole clickeado.");
  }

  // Intento 2: texto directo
  if (!tabClicked) {
    const tabByText = page.locator('text="Other Android"');
    if (await tabByText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabByText.click({ force: true });
      tabClicked = true;
      console.log("  → Tab via text locator clickeado.");
    }
  }

  // Intento 3: buscar en shadow DOM y click via JS
  if (!tabClicked) {
    const jsClicked = await page.evaluate(() => {
      function deepFind(root, fn) {
        for (const el of root.querySelectorAll("*")) {
          if (fn(el)) return el;
          if (el.shadowRoot) {
            const f = deepFind(el.shadowRoot, fn);
            if (f) return f;
          }
        }
        return null;
      }
      const tab = deepFind(document, el =>
        /other android/i.test(el.textContent?.trim() || "") &&
        el.getBoundingClientRect().width > 0
      );
      if (tab) { tab.click(); return tab.textContent?.trim(); }
      return null;
    });
    if (jsClicked) {
      tabClicked = true;
      console.log(`  → Tab via JS: "${jsClicked}"`);
    }
  }

  if (!tabClicked) {
    // El tab puede no existir o el nombre puede ser diferente
    // Tomar screenshot para diagnóstico
    await screenshot(page, "other-android-tab-not-found");
    console.warn("  [warn] Tab 'Other Android' no encontrado. Tomando screenshot y continuando con lo que hay visible.");
  }

  await page.waitForTimeout(1500);
  await screenshot(page, "other-android-tab-after");

  // ── PASO 6: Llenar formulario ─────────────────────────────────────────────
  console.log("[paso 6] Llenando formulario…");
  await page.waitForTimeout(1000);
  await screenshot(page, "form-visible");

  // Usar Playwright fill que auto-pierces Shadow DOM
  async function tryFill(locators, value, fieldName) {
    for (const loc of locators) {
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loc.click({ clickCount: 3 });
        await loc.fill(value);
        console.log(`  → ${fieldName}: "${value}"`);
        return true;
      }
    }
    // Intentar via JS
    const jsResult = await page.evaluate((args) => {
      const [patterns, value] = args;
      function deepFindAll(root) {
        const results = [];
        for (const el of root.querySelectorAll("input, sl-input")) {
          results.push(el);
        }
        for (const el of root.querySelectorAll("*")) {
          if (el.shadowRoot) results.push(...deepFindAll(el.shadowRoot));
        }
        return results;
      }
      const inputs = deepFindAll(document);
      for (const inp of inputs) {
        const attrs = [inp.label, inp.placeholder, inp.id, inp.name, inp.getAttribute("label")].join(" ");
        if (patterns.some(p => new RegExp(p, "i").test(attrs))) {
          const rect = inp.getBoundingClientRect();
          if (rect.width > 0) {
            inp.value = value;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            return `${inp.tagName}[${attrs.trim()}] = ${value}`;
          }
        }
      }
      return null;
    }, [["package", "id"], value]);
    if (jsResult) console.log(`  → JS fill ${fieldName}: ${jsResult}`);
    return !!jsResult;
  }

  // Package ID
  await tryFill([
    page.getByLabel(/package id/i),
    page.locator('input[id*="package"]'),
    page.locator('sl-input[label*="Package"]'),
  ], "mx.hectoria.cotizador", "Package ID");

  // App name
  await tryFill([
    page.getByLabel(/app name/i),
    page.locator('input[id*="appName"], input[id*="app-name"]'),
    page.locator('sl-input[label*="App name"], sl-input[label*="Name"]'),
  ], "Cotizador", "App name");

  await screenshot(page, "form-filled");

  // ── PASO 7: Esperar que "Download Package" esté habilitado y hacer click ──
  console.log("[paso 7] Esperando que 'Download Package' esté habilitado…");
  await page.waitForTimeout(2000);
  await screenshot(page, "before-download-package-btn");

  // Esperar que el botón Download Package no esté disabled (hasta 30s)
  let dlBtn = null;
  const dlBtnLocator = page.getByRole("button", { name: /download package/i });

  try {
    await page.waitForFunction(
      () => {
        const btns = [...document.querySelectorAll("button")].filter(b =>
          /download package/i.test(b.textContent || "")
        );
        return btns.some(b => !b.disabled && b.getBoundingClientRect().width > 0);
      },
      { timeout: 30000 }
    );
    dlBtn = dlBtnLocator;
    console.log("  → 'Download Package' habilitado.");
  } catch {
    // Puede estar disabled por error previo — intentar igual
    console.warn("  [warn] 'Download Package' puede estar disabled. Intentando click de todas formas.");
    dlBtn = dlBtnLocator;
  }

  await screenshot(page, "download-package-btn-state");

  // ── PASO 8: Click Download Package y esperar job completion ──────────────
  console.log("[paso 8] Click 'Download Package' y esperando job completion…");
  console.log("  (PWABuilder encola un job — puede tardar 5-10 min)");

  // Click el botón
  await dlBtn.click({ force: true });
  await page.waitForTimeout(5000); // dar tiempo para que el job se encole
  await screenshot(page, "after-download-click");

  // Verificar si hubo error 500
  const hasError500 = await page.locator("text=/500|Internal Server Error/i").isVisible({ timeout: 2000 }).catch(() => false);
  if (hasError500) {
    console.error("  [ERROR 500] PWABuilder devolvió error 500 al encolar el job.");
    console.error("  → Android API base URL detectada:", androidApiBaseUrl);
    console.error("  → Esto es un problema del servidor de PWABuilder, no de nuestra configuración.");
    await screenshot(page, "error-500-detected");
    await failDump(page, "server-error-500", "PWABuilder devolvió error 500 al encolar el job Android. El servidor de PWABuilder está fallando — no es un problema del APK/manifest/configuración. Intenta de nuevo más tarde o manualmente.");
  }

  // Determinar si estamos en la página de job status o si el download ocurrió
  const currentUrl = page.url();
  console.log(`  → URL actual: ${currentUrl}`);
  console.log(`  → Job ID capturado: ${lastJobId}`);
  console.log(`  → API base URL: ${androidApiBaseUrl}`);

  let download = null;

  // Si la página dice "Waiting for agent" o "job", esperamos el link de descarga
  const isJobPage = await page.locator("text=/waiting for agent|queuing|queued|job/i").isVisible({ timeout: 5000 }).catch(() => false);

  if (isJobPage || lastJobId) {
    console.log("  → Job encolado. Esperando que termine (hasta 10 min)…");
    await screenshot(page, "job-queued");

    // Estrategia 1: Si tenemos Job ID y API URL, usar la API directamente
    if (lastJobId && androidApiBaseUrl) {
      console.log(`  → Usando API directa. Job ID: ${lastJobId}`);
      console.log(`  → API: ${androidApiBaseUrl}`);

      const jobTimeoutMs = 600000; // 10 min
      const jobStart = Date.now();
      let jobDone = false;

      while (Date.now() - jobStart < jobTimeoutMs) {
        await page.waitForTimeout(8000);
        const elapsed = Math.round((Date.now() - jobStart) / 1000);

        // Poll job status via API
        try {
          const statusUrl = `${androidApiBaseUrl}/getPackageJob?id=${encodeURIComponent(lastJobId)}`;
          const { stdout: statusRaw } = await exec(
            `powershell -Command "Invoke-WebRequest -Uri '${statusUrl}' -UseBasicParsing | Select-Object -ExpandProperty Content"`
          ).catch(e => ({ stdout: `{"error": "${e.message}"}` }));

          const status = JSON.parse(statusRaw.trim());
          console.log(`  [${elapsed}s] Job status: ${status.status || JSON.stringify(status).substring(0, 100)}`);

          if (status.status === "Completed") {
            console.log("  → Job completado. Descargando ZIP…");
            const zipUrl = `${androidApiBaseUrl}/downloadPackageZip?id=${encodeURIComponent(lastJobId)}`;
            await exec(
              `powershell -Command "Invoke-WebRequest -Uri '${zipUrl}' -OutFile '${ZIP_DEST}' -UseBasicParsing"`
            );
            console.log(`  → ZIP descargado: ${ZIP_DEST}`);
            download = null; // descargado via PowerShell
            jobDone = true;
            break;
          } else if (status.status === "Failed") {
            await failDump(page, "job-api-failed", `Job falló en servidor. Status: ${JSON.stringify(status)}`);
          }
        } catch (e) {
          console.warn(`  [${elapsed}s] Error polling job: ${e.message}`);
        }

        if (elapsed % 60 < 10) {
          await screenshot(page, `job-api-waiting-${elapsed}s`);
        }
      }

      if (!jobDone) {
        await failDump(page, "job-api-timeout", "Job no completó en 10 min via API directa.");
      }
    } else {
      // Estrategia 2: Esperar link de descarga en la página
      const jobTimeoutMs = 600000;
      const jobStart = Date.now();
      let downloadLink = null;
      let lastScreenshotAt = Date.now();

      while (Date.now() - jobStart < jobTimeoutMs) {
        await page.waitForTimeout(8000);
        const elapsed = Math.round((Date.now() - jobStart) / 1000);

        if (Date.now() - lastScreenshotAt > 60000) {
          await screenshot(page, `job-waiting-${elapsed}s`);
          lastScreenshotAt = Date.now();
        }

        const dlLinkVisible = await page.locator('a[href*=".zip"], a[href*=".apk"], a[download], button:has-text("Download"), a:has-text("Download")').isVisible({ timeout: 2000 }).catch(() => false);
        const errorVisible = await page.locator("text=/error|failed|failure/i").isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`  [${elapsed}s] dlLink=${dlLinkVisible}, error=${errorVisible}, jobId=${lastJobId}`);

        if (errorVisible) {
          await screenshot(page, "job-error");
          const errText = await page.locator("text=/error|failed/i").first().textContent().catch(() => "unknown");
          await failDump(page, "job-failed", `Job falló con error: "${errText}"`);
        }

        if (dlLinkVisible) {
          downloadLink = page.locator('a[href*=".zip"], a[href*=".apk"], a[download], button:has-text("Download"), a:has-text("Download")').first();
          console.log(`  → Link de descarga encontrado.`);
          break;
        }

        // Si conseguimos el Job ID mientras esperamos, usar API directa
        if (lastJobId && androidApiBaseUrl) {
          console.log(`  → Job ID detectado: ${lastJobId}. Cambiando a API directa.`);
          break;
        }
      }

      if (downloadLink) {
        await screenshot(page, "before-final-download");
        try {
          [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 120000 }),
            downloadLink.click({ force: true }),
          ]);
        } catch (err) {
          const href = await downloadLink.getAttribute("href").catch(() => null);
          if (href) {
            await exec(`powershell -Command "Invoke-WebRequest -Uri '${href}' -OutFile '${ZIP_DEST}' -UseBasicParsing"`);
            download = null;
          } else {
            await failDump(page, "final-download", `No se pudo descargar: ${err.message}`);
          }
        }
      } else if (lastJobId && androidApiBaseUrl) {
        // Usar API directa
        const zipUrl = `${androidApiBaseUrl}/downloadPackageZip?id=${encodeURIComponent(lastJobId)}`;
        await exec(`powershell -Command "Invoke-WebRequest -Uri '${zipUrl}' -OutFile '${ZIP_DEST}' -UseBasicParsing"`);
        download = null;
      } else {
        await failDump(page, "job-timeout", "Job no completó y no hay link de descarga.");
      }
    }
  } else {
    // La descarga puede venir directamente
    console.log("  → No es página de job. Esperando evento download directo…");
    try {
      download = await page.waitForEvent("download", { timeout: 60000 });
    } catch (err) {
      await screenshot(page, "download-error-state");
      // Si tenemos job id capturado, intentar descarga directa
      if (lastJobId && androidApiBaseUrl) {
        console.log(`  → Intentando descarga directa via API con Job ID: ${lastJobId}`);
        const zipUrl = `${androidApiBaseUrl}/downloadPackageZip?id=${encodeURIComponent(lastJobId)}`;
        await exec(`powershell -Command "Invoke-WebRequest -Uri '${zipUrl}' -OutFile '${ZIP_DEST}' -UseBasicParsing"`);
        download = null;
      } else {
        await failDump(page, "download-event", `No se recibió evento download: ${err.message}`);
      }
    }
  }

  if (download) {
    await screenshot(page, "download-received");
    console.log(`  → Archivo: ${download.suggestedFilename()}`);
    await download.saveAs(ZIP_DEST);
    console.log(`  → Guardado: ${ZIP_DEST}`);
  } else {
    // Ya se descargó via PowerShell
    console.log(`  → Archivo descargado via PowerShell: ${ZIP_DEST}`);
    if (!fs.existsSync(ZIP_DEST)) {
      await failDump(page, "zip-missing", "ZIP no encontrado después de descarga via PowerShell.");
    }
  }
  await browser.close();

  // ── PASO 9: Extraer APK ───────────────────────────────────────────────────
  console.log("[paso 9] Extrayendo ZIP…");
  const extractDir = path.join(TMP_DIR, "pwabuilder-extracted");
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
  fs.mkdirSync(extractDir);

  await exec(`powershell -Command "Expand-Archive -Path '${ZIP_DEST}' -DestinationPath '${extractDir}' -Force"`);

  const { stdout: listing } = await exec(
    `powershell -Command "Get-ChildItem -Recurse '${extractDir}' | Select-Object FullName | Format-Table -HideTableHeaders"`
  );
  console.log("  Contenido:\n" + listing);

  const { stdout: apkRaw } = await exec(
    `powershell -Command "Get-ChildItem -Recurse '${extractDir}' -Filter '*.apk' | Select-Object -ExpandProperty FullName"`
  );
  const apkPath = apkRaw.trim().split("\n")[0]?.trim();

  if (!apkPath || !fs.existsSync(apkPath)) {
    console.error("[FALLO] No .apk encontrado en ZIP.");
    console.error(listing);
    process.exit(1);
  }

  fs.copyFileSync(apkPath, APK_DEST);

  // Mover keystore
  for (const filter of ["*.keystore", "key.json"]) {
    const { stdout } = await exec(
      `powershell -Command "Get-ChildItem -Recurse '${extractDir}' -Filter '${filter}' | Select-Object -ExpandProperty FullName"`
    ).catch(() => ({ stdout: "" }));
    const p = stdout.trim().split("\n")[0]?.trim();
    if (p && fs.existsSync(p)) {
      const dest = path.join(TWA_DIR, path.basename(p));
      fs.copyFileSync(p, dest);
      console.log(`  → ${path.basename(p)} → ${dest}`);
    }
  }

  // ── PASO 10: Verificar ────────────────────────────────────────────────────
  const stats = fs.statSync(APK_DEST);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  if (stats.size < 1024 * 1024) {
    console.error(`[FALLO] APK demasiado pequeño: ${sizeMB} MB`);
    process.exit(1);
  }

  console.log("\n=== EXITO ===");
  console.log(`APK: ${APK_DEST}`);
  console.log(`Tamaño: ${sizeMB} MB`);
  console.log(`URL: https://cotizador.hectoria.mx/cotizador.apk`);
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message);
  console.error(err.stack);
  process.exit(1);
});
