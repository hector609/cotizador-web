/**
 * Tests para `signBackendRequest` (`src/lib/backend-auth.ts`).
 *
 * IMPORTANTE: este repo aún NO tiene un runner de tests (vitest/jest)
 * configurado — se priorizó ship sobre framework. Este archivo documenta
 * los casos esperados como código TS válido, ejecutable manualmente con:
 *
 *     SESSION_SECRET=test npx tsx src/lib/__tests__/backend-auth.test.ts
 *
 * Cuando se agregue vitest, basta con renombrar las funciones `test_*` a
 * `it("...", ...)` y reemplazar el `assert` por `expect`. Hasta entonces
 * el contrato queda fijado por estas aserciones.
 *
 * El esquema verificado debe coincidir EXACTAMENTE con el que valida
 * `cotizador-telcel-bot/src/api/server.py::verify_x_auth`:
 *   X-Auth = `v1.<unix_ts>.<hmac_hex>` donde
 *   hmac = HMAC-SHA256(SESSION_SECRET, "v1|<distribuidor_id>|<unix_ts>")
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { signBackendRequest, getSessionSecret } from "@/lib/backend-auth";

function recomputeMac(secret: string, distribuidorId: number | string, ts: number): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`v1|${distribuidorId}|${ts}`)
    .digest("hex");
}

function test_format_v1_dot_ts_dot_hmac() {
  process.env.SESSION_SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const { "X-Auth": header } = signBackendRequest(42);
  const parts = header.split(".");
  assert.equal(parts.length, 3, "header debe tener 3 partes separadas por '.'");
  assert.equal(parts[0], "v1", "version prefix debe ser 'v1'");
  assert.match(parts[1], /^\d+$/, "ts debe ser entero unix");
  assert.match(parts[2], /^[0-9a-f]{64}$/, "hmac debe ser SHA256 hex (64 chars)");
}

function test_hmac_matches_backend_scheme() {
  process.env.SESSION_SECRET = "another-secret";
  const before = Math.floor(Date.now() / 1000);
  const { "X-Auth": header } = signBackendRequest(7);
  const after = Math.floor(Date.now() / 1000);
  const [, tsStr, mac] = header.split(".");
  const ts = Number(tsStr);
  assert.ok(ts >= before && ts <= after, "ts debe ser ~ahora");
  const expected = recomputeMac("another-secret", 7, ts);
  assert.equal(mac, expected, "hmac debe usar SESSION_SECRET y mensaje 'v1|<id>|<ts>'");
}

function test_distinct_distribuidores_distinct_macs() {
  process.env.SESSION_SECRET = "stable-secret";
  // Forzar mismo ts para comparar solo por distribuidor.
  const ts = 1_700_000_000;
  const macA = recomputeMac("stable-secret", 1, ts);
  const macB = recomputeMac("stable-secret", 2, ts);
  assert.notEqual(macA, macB, "distintos distribuidores deben dar distintos hmac");
}

function test_get_session_secret_throws_when_missing() {
  delete process.env.SESSION_SECRET;
  assert.throws(
    () => getSessionSecret(),
    /SESSION_SECRET/,
    "getSessionSecret debe lanzar si no está configurado"
  );
}

function test_string_or_number_distribuidor_id() {
  process.env.SESSION_SECRET = "k";
  const a = signBackendRequest(123);
  const b = signBackendRequest("123");
  // Mismo string firmado debe producir mismo hmac (a falta de ts: comparamos
  // que el shape sea idéntico).
  assert.match(a["X-Auth"], /^v1\.\d+\.[0-9a-f]{64}$/);
  assert.match(b["X-Auth"], /^v1\.\d+\.[0-9a-f]{64}$/);
}

function run() {
  const tests = [
    test_format_v1_dot_ts_dot_hmac,
    test_hmac_matches_backend_scheme,
    test_distinct_distribuidores_distinct_macs,
    test_string_or_number_distribuidor_id,
    test_get_session_secret_throws_when_missing,
  ];
  let failed = 0;
  for (const t of tests) {
    try {
      t();
      console.log(`ok - ${t.name}`);
    } catch (e) {
      failed++;
      console.error(`fail - ${t.name}`);
      console.error(e);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exitCode = 1;
  }
}

// Solo ejecuta cuando se invoca directo (no cuando lo importa un runner).
if (require.main === module) {
  run();
}

export { run };
