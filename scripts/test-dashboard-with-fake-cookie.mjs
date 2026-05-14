/**
 * test-dashboard-with-fake-cookie.mjs
 *
 * Generates a valid signed session cookie using the same algorithm as
 * /api/auth/login (base64url JSON payload + HMAC-SHA256 hex sig),
 * then hits the live Vercel endpoints to diagnose "Error en backend".
 *
 * Usage: node scripts/test-dashboard-with-fake-cookie.mjs
 */

import crypto from "crypto";

const SESSION_SECRET =
  "deae9b27d7cbc871749c7855678794cbdf7cb15bc2952c391b3abbb684d0fb7e";

// Known good values for Hector / celumaster admin.
// vendedor_id = Hector's Telegram ID, distribuidor_id from web_passwords.json
// We use the same distribuidor_id the bot uses for celumaster.
// From memory: the bot signs X-Auth with distribuidor_id.
// The actual distribuidor_id for celumaster isn't known without DB access,
// but we can use vendedor_id=901466695 (Hector's Telegram ID from memory notes)
// and any numeric distribuidor_id — the cookie verification only checks the fields
// exist and are numbers (not values), so any valid ints work for auth.ts.
// For the upstream X-Auth, it uses distribuidor_id to sign — if wrong,
// the bot will return 401/403.

// Let's use a real-looking celumaster distribuidor_id.
// From project notes, the bot uses distribuidor_id. We'll try with 901466695
// as both for the cookie test (cookie itself will be valid, but upstream may fail).
// The point is to test if the cookie verifies — if we get 401 from vercel it's
// cookie format issue; if we get 403/502 it's an upstream issue.

const now = Math.floor(Date.now() / 1000);
const sessionPayload = {
  vendedor_id: 901466695,
  distribuidor_id: 901466695, // placeholder — may cause 403 from bot, but not from Next.js layer
  role: "admin",
  iat: now,
  exp: now + 3600,
};

function makeSessionCookie(payload) {
  const sessionStr = JSON.stringify(payload);
  const sessionB64 = Buffer.from(sessionStr).toString("base64url");
  const sessionSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(sessionB64)
    .digest("hex");
  return `${sessionB64}.${sessionSig}`;
}

const cookie = makeSessionCookie(sessionPayload);

console.log("=== Cookie generada ===");
console.log("Payload:", JSON.stringify(sessionPayload, null, 2));
console.log("Cookie (primeros 80 chars):", cookie.substring(0, 80) + "...");
console.log();

const BASE = "https://cotizador.hectoria.mx";

async function testEndpoint(label, url, options = {}) {
  console.log(`--- ${label} ---`);
  console.log("URL:", url);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Cookie: `session=${encodeURIComponent(cookie)}`,
        Accept: "application/json",
        ...(options.headers || {}),
      },
      redirect: "manual",
    });
    const body = await res.text();
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    console.log("Body (primeros 500):", body.substring(0, 500));
    if (res.status >= 300 && res.status < 400) {
      console.log("Location:", res.headers.get("location"));
    }
    console.log();
    return { status: res.status, body };
  } catch (e) {
    console.error("FETCH ERROR:", e.message);
    console.log();
    return { status: 0, body: null, error: e.message };
  }
}

// Test 1: /api/cotizaciones
await testEndpoint("GET /api/cotizaciones?limit=10", `${BASE}/api/cotizaciones?limit=10`);

// Test 2: /api/clientes
await testEndpoint("GET /api/clientes", `${BASE}/api/clientes`);

// Test 3: /api/cotizaciones without cookie (should get 401)
console.log("--- GET /api/cotizaciones (SIN cookie, debe dar 401) ---");
try {
  const res = await fetch(`${BASE}/api/cotizaciones?limit=1`, {
    headers: { Accept: "application/json" },
    redirect: "manual",
  });
  const body = await res.text();
  console.log("Status:", res.status, "(esperado 401)");
  console.log("Body:", body.substring(0, 200));
} catch (e) {
  console.error("FETCH ERROR:", e.message);
}
console.log();

// Test 4: Direct bot hit to confirm backend works
console.log("--- Direct bot /api/v1/cotizaciones (SIN X-Auth, debe dar 401) ---");
try {
  const res = await fetch("https://cmdemobot.fly.dev/api/v1/cotizaciones?limit=5", {
    headers: { Accept: "application/json" },
    redirect: "manual",
  });
  const body = await res.text();
  console.log("Status:", res.status, "(esperado 401)");
  console.log("Body:", body.substring(0, 200));
} catch (e) {
  console.error("FETCH ERROR:", e.message);
}
console.log();

// Test 5: Direct bot with valid X-Auth (we compute it ourselves)
console.log("--- Direct bot /api/v1/cotizaciones CON X-Auth válido ---");
try {
  const ts = Math.floor(Date.now() / 1000);
  const distribuidorId = sessionPayload.distribuidor_id;
  const message = `v1|${distribuidorId}|${ts}`;
  const mac = crypto.createHmac("sha256", SESSION_SECRET).update(message).digest("hex");
  const xAuth = `v1.${ts}.${mac}`;

  const res = await fetch(`https://cmdemobot.fly.dev/api/v1/cotizaciones?limit=5`, {
    headers: {
      Accept: "application/json",
      "X-Auth": xAuth,
    },
    redirect: "manual",
  });
  const body = await res.text();
  console.log("Status:", res.status);
  console.log("X-Auth used:", xAuth.substring(0, 60) + "...");
  console.log("distribuidor_id used:", distribuidorId);
  console.log("Body (primeros 500):", body.substring(0, 500));
} catch (e) {
  console.error("FETCH ERROR:", e.message);
}
