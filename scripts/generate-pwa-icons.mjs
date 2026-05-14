#!/usr/bin/env node
/**
 * scripts/generate-pwa-icons.mjs
 *
 * Genera los iconos PWA + og.png a partir del logo LUMINA en
 * `public/brand/logo-cotizador-mark.svg`. Usa `sharp` para rasterizar
 * SVG → PNG de forma determinística (NO usar MCPs de imagen para iconos:
 * son lentos y poco precisos).
 *
 * Outputs:
 *   public/icons/icon-192.png            (192x192, any)
 *   public/icons/icon-512.png            (512x512, any)
 *   public/icons/icon-192-maskable.png   (192x192, maskable — 80% safe zone)
 *   public/icons/icon-512-maskable.png   (512x512, maskable — 80% safe zone)
 *   public/og.png                        (1200x630, Open Graph)
 *
 * Re-ejecutar cuando cambie el logo o la paleta. Idempotente — overwrite.
 *
 * Uso:  node scripts/generate-pwa-icons.mjs
 */

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BRAND_DIR = path.join(ROOT, "public", "brand");
const ICONS_DIR = path.join(ROOT, "public", "icons");
const OG_PATH = path.join(ROOT, "public", "og.png");

// Colores LUMINA (mantener en sync con public/brand/README.md y manifest.json).
const INDIGO = "#4F46E5";
const CYAN = "#06B6D4";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readMark() {
  const markPath = path.join(BRAND_DIR, "logo-cotizador-mark.svg");
  return fs.readFile(markPath);
}

/**
 * Genera icono "any" (tile completo, sin safe area extra).
 * El SVG mark ya tiene rounded corners + gradient — sólo escalar.
 */
async function generateAnyIcon(markBuffer, size, outPath) {
  await sharp(markBuffer, { density: Math.ceil((size / 64) * 72) })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log(`  wrote ${path.relative(ROOT, outPath)} (${size}x${size}, any)`);
}

/**
 * Genera icono "maskable" — la spec PWA requiere que el contenido relevante
 * esté dentro del 80% central (safe zone). El sistema operativo recorta los
 * bordes para meterlo en círculos / squircles / etc.
 *
 * Estrategia: tile gradient indigo→cyan a fullbleed + mark escalado al 60%
 * centrado encima (deja 20% padding alrededor).
 */
async function generateMaskableIcon(markBuffer, size, outPath) {
  const innerSize = Math.round(size * 0.6);
  const offset = Math.round((size - innerSize) / 2);

  // 1. Fondo: SVG gradient indigo→cyan (mismo gradient del mark).
  const bgSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${INDIGO}"/>
          <stop offset="1" stop-color="${CYAN}"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
    </svg>
  `);

  // 2. Mark escalado al 60% — solo necesitamos el glyph (arco + dots),
  //    pero por simplicidad rasterizamos el mark completo y luego lo
  //    componemos sin su fondo. El fondo del mark también es indigo→cyan,
  //    así que se funde con el bg fullbleed.
  const inner = await sharp(markBuffer, { density: Math.ceil((innerSize / 64) * 72) })
    .resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(bgSvg)
    .composite([{ input: inner, top: offset, left: offset }])
    .png()
    .toFile(outPath);
  console.log(`  wrote ${path.relative(ROOT, outPath)} (${size}x${size}, maskable, 60% safe)`);
}

/**
 * og.png — 1200x630 para Open Graph (Twitter, FB, WhatsApp previews).
 *
 * Spec (de public/brand/README.md):
 *   - Background: gradient diagonal indigo → cyan.
 *   - Wordmark "Cotizador" centrado, Geist 800 white ~120px.
 *   - Subtítulo "Cotiza Telcel en minutos" Geist 500 white/80 ~32px.
 *   - Iconmark esquina inferior derecha opcional (88x88).
 *
 * Como `sharp` no tiene engine de fonts confiable cross-platform, dibujamos
 * el texto vía SVG (deja al motor SVG/system-ui hacer fallback). El
 * resultado visual es OK aunque no sea Geist exacto — el renderer de previews
 * tiene su propio motor, no necesitamos pixel-perfect.
 */
async function generateOgImage(markBuffer, outPath) {
  const W = 1200;
  const H = 630;

  // Mark rasterizado a 160x160 para esquina inferior derecha.
  const markSize = 160;
  const mark = await sharp(markBuffer, { density: Math.ceil((markSize / 64) * 72) })
    .resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // SVG entero del fondo + texto, sharp lo rasteriza con sus fonts del sistema
  // (Geist no estará instalada en runners CI normalmente — fallback a sans-serif).
  const ogSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="og-bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${INDIGO}"/>
          <stop offset="1" stop-color="${CYAN}"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#og-bg)"/>
      <text x="${W / 2}" y="${H / 2 - 10}"
            text-anchor="middle"
            fill="#FFFFFF"
            font-family="Geist, 'Geist Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
            font-weight="800"
            font-size="120"
            letter-spacing="-2.4">Cotizador</text>
      <text x="${W / 2}" y="${H / 2 + 80}"
            text-anchor="middle"
            fill="rgba(255,255,255,0.85)"
            font-family="Geist, 'Geist Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
            font-weight="500"
            font-size="32"
            letter-spacing="-0.32">Cotiza Telcel en minutos</text>
    </svg>
  `);

  await sharp(ogSvg)
    .composite([
      {
        input: mark,
        top: H - markSize - 56, // 56px padding bottom
        left: W - markSize - 56, // 56px padding right
      },
    ])
    .png()
    .toFile(outPath);
  console.log(`  wrote ${path.relative(ROOT, outPath)} (${W}x${H}, og)`);
}

async function main() {
  console.log("[icons] generating PWA + og from logo-cotizador-mark.svg...");

  await ensureDir(ICONS_DIR);

  const mark = await readMark();

  await generateAnyIcon(mark, 192, path.join(ICONS_DIR, "icon-192.png"));
  await generateAnyIcon(mark, 512, path.join(ICONS_DIR, "icon-512.png"));
  await generateMaskableIcon(mark, 192, path.join(ICONS_DIR, "icon-192-maskable.png"));
  await generateMaskableIcon(mark, 512, path.join(ICONS_DIR, "icon-512-maskable.png"));
  await generateOgImage(mark, OG_PATH);

  console.log("[icons] done.");
}

main().catch((err) => {
  console.error("[icons] FAILED:", err);
  process.exit(1);
});
