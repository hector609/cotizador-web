import crypto from "node:crypto";
import zlib from "node:zlib";

const SECRET = "deae9b27d7cbc871749c7855678794cbdf7cb15bc2952c391b3abbb684d0fb7e";
const BOT_URL = "https://cmdemobot.fly.dev";

// Calcular distribuidor_id para celumaster
const did = zlib.crc32(Buffer.from("celumaster")) & 0x7FFFFFFF;
console.log("distribuidor_id celumaster:", did);

// Firmar X-Auth
const ts = Math.floor(Date.now() / 1000);
const msg = `v1|${did}|${ts}`;
const mac = crypto.createHmac("sha256", SECRET).update(msg).digest("hex");
const xAuth = `v1.${ts}.${mac}`;
console.log("X-Auth header:", xAuth);

// Llamar bot directo
for (const path of ["/api/v1/clientes", "/api/v1/cotizaciones", "/api/v1/cotizaciones?limit=10"]) {
  const r = await fetch(`${BOT_URL}${path}`, {
    headers: { "X-Auth": xAuth, Accept: "application/json" },
  });
  const body = await r.text();
  console.log(`\n${path} -> ${r.status}`);
  console.log("Body (first 500 chars):", body.slice(0, 500));
}
