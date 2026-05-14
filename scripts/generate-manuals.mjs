#!/usr/bin/env node
/**
 * scripts/generate-manuals.mjs
 *
 * Genera los manuales PDF premium (Telegram + Web) para los pilotos del cotizador.
 * Usa Playwright headless Chromium para renderizar HTML → PDF con fidelidad tipográfica.
 *
 * Outputs:
 *   public/manual-telegram.pdf   (Manual del Bot @CMdemobot)
 *   public/manual-web.pdf        (Manual de cotizador.hectoria.mx)
 *
 * Uso:  node scripts/generate-manuals.mjs
 */

import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANUALS_DIR = path.join(__dirname, "manuals");
const PUBLIC_DIR = path.join(ROOT, "public");

const PDF_OPTIONS = {
  format: "Letter",
  printBackground: true,
  margin: {
    top: "15mm",
    bottom: "15mm",
    left: "12mm",
    right: "12mm",
  },
};

const MANUALS = [
  {
    htmlFile: "manual-telegram.html",
    pdfFile: "manual-telegram.pdf",
    label: "Manual Bot Telegram (@CMdemobot)",
  },
  {
    htmlFile: "manual-web.html",
    pdfFile: "manual-web.pdf",
    label: "Manual Web (cotizador.hectoria.mx)",
  },
];

async function generateManual(browser, { htmlFile, pdfFile, label }) {
  const htmlPath = path.join(MANUALS_DIR, htmlFile);
  const pdfPath = path.join(PUBLIC_DIR, pdfFile);

  const html = await fs.readFile(htmlPath, "utf-8");

  const page = await browser.newPage();

  // Set viewport to Letter width (816px @ 96dpi)
  await page.setViewportSize({ width: 816, height: 1056 });

  // Load HTML content — use file:// base URL so relative refs work
  await page.setContent(html, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });

  // Wait for fonts to load (Inter via Google Fonts CDN may be blocked in headless)
  // We gracefully skip if network is unavailable — system-ui fallback is fine.
  await page.waitForTimeout(800);

  await page.pdf({
    path: pdfPath,
    ...PDF_OPTIONS,
  });

  await page.close();

  const stat = await fs.stat(pdfPath);
  const kb = Math.round(stat.size / 1024);
  console.log(`  ✓ ${label}`);
  console.log(`    → ${path.relative(ROOT, pdfPath)} (${kb} KB)`);

  return { pdfFile, sizeKb: kb };
}

async function main() {
  console.log("[manuals] Iniciando generación de PDFs premium...\n");

  // Ensure public dir exists
  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const results = [];

  try {
    for (const manual of MANUALS) {
      process.stdout.write(`  Generando: ${manual.label}...\n`);
      const result = await generateManual(browser, manual);
      results.push(result);
    }
  } finally {
    await browser.close();
  }

  console.log("\n[manuals] Listo. PDFs generados:\n");
  for (const { pdfFile, sizeKb } of results) {
    const ok = sizeKb >= 100 ? "✓" : "⚠ (< 100 KB — revisar)";
    console.log(`  ${ok}  public/${pdfFile}  ${sizeKb} KB`);
  }

  const anyFailed = results.some((r) => r.sizeKb < 50);
  if (anyFailed) {
    console.error("\n[manuals] ERROR: Algún PDF es demasiado pequeño — revisar HTML.");
    process.exit(1);
  }

  console.log("\n[manuals] ¡Todos los PDFs listos para distribución!");
}

main().catch((err) => {
  console.error("[manuals] FAILED:", err);
  process.exit(1);
});
