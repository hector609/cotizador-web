# Audit: Auth + Rewrite Consistency in API Routes
**Date:** 2026-05-14  
**Scope:** `/api/cotizaciones/*` + related endpoints  
**Status:** NO CRITICAL ISSUES FOUND

---

## Audit Checklist Results

| Endpoint | Auth | 401/403 | Sign | Status Handling | PDF Rewrite | Network Error | Notes |
|----------|------|---------|------|-----------------|-------------|---------------|-------|
| `GET /api/cotizaciones` | ✅ | ✅ | ✅ | ✅ (404→empty) | ✅ (List) | ✅ | Full coverage |
| `POST /api/cotizaciones` | ✅ | ✅ | ✅ | ✅ (400/422) | N/A | ✅ | Idempotency cache + RFC validation |
| `GET /api/cotizaciones/[id]` | ✅ | ✅ | ✅ | ✅ (404/409) | ✅ (Sanitize) | ✅ | ID regex + sanitizeCotizacion |
| `GET /api/cotizaciones/[id]/pdf` | ✅ | ✅ | ✅ | ✅ (404/409) | N/A | ✅ | Stream pass-through, formato whitelist |
| `GET /api/cotizaciones/[id]/screenshot` | ✅ | ✅ | ✅ | ✅ (404/409) | N/A | ✅ | PNG stream, inline disposition |
| `GET /api/cotizaciones/[id]/excel` | ✅ | ✅ | ✅ | ✅ (400/404) | N/A | ✅ | arrayBuffer (2MB cap by parent POST) |
| `POST /api/cotizaciones/excel` | ✅ | ✅ | ✅ | ✅ (400/422) | N/A | ✅ | File size + ext validation, base64 |
| `GET /api/clientes` | ✅ | ✅ | ✅ | ✅ (404→empty) | N/A | ✅ | Shape normalization (nombre/razon_social) |
| `POST /api/optimizar` | ✅ | ✅ | ✅ | ✅ (400/422/503/504) | N/A | ✅ | AbortController timeout (35s), graceful 503 |
| `GET /api/catalogos/equipos` | ✅ | ✅ | ✅ | ✅ (404→empty) | N/A | ✅ | Query whitelist (marca, q) |
| `GET /api/catalogos/planes` | ✅ | ✅ | ✅ | ✅ (404→empty) | N/A | ✅ | Query whitelist (grupo, modalidad, plazo) |

---

## Key Findings

### Auth Consistency (✅ CONSISTENT)
- **11/11 endpoints** use `getSessionFromRequest()` → 401 if missing
- All return `{ error: "msg" }` JSON format
- All `signBackendRequest(session.distribuidor_id)` before upstream fetch
- No tenant_id/telegram_id leaked to query strings (correct)

### Status Code Handling (✅ CONSISTENT)
All endpoints follow pattern:
- `401/403` → return 403 "No autorizado"
- `404` → 404 or graceful empty (collections) or passthrough (PDFs)
- `400/422` → return 400 with message
- `409` → return 409 (cotizaciones only: pending/failed)
- `5xx` → return 502 "Backend no disponible"
- `AbortError` timeout → 504 (optimizar only, explicit)

### PDF URL Rewriting (✅ CORRECT)
- **List endpoint** (`GET /api/cotizaciones`): rewritePdfUrl() each item
- **Single endpoint** (`GET /api/cotizaciones/[id]`): sanitizeCotizacion() validates + rewrites
- Both validate path format with regex before rewrite
- Both discard field if pattern mismatch (no injection)
- PDF/screenshot endpoints (pdf/screenshot/route.ts) are proxies, no further rewriting

### Network Error Handling (✅ COMPLETE)
- All endpoints wrap fetch() in try-catch
- All console.error() for observability
- All return 502 on network failure
- **optimizar** adds explicit AbortController + timeout handling

### Input Validation (✅ DEFENSE IN DEPTH)
- ID regex whitelist: `/^[a-f0-9]{32}$/i` or `/^[A-Za-z0-9_-]{1,64}$/` (upstream validates too)
- Query params whitelisted per endpoint (no pass-through)
- RFC regex validated on POST
- File extension + size validated on excel POST
- Body type-checking before upstream dispatch

---

## Edge Cases Verified

1. **Idempotency cache** (POST /api/cotizaciones): TTL 5min, in-memory (caveat: single-region only, TODO comment present)
2. **Multi-perfil support** (POST /api/cotizaciones): perfiles[] array (1-10) validated, totalLineas capped at 1000
3. **Graceful 404s**: list endpoints return empty arrays (not errors) so UI survives backend lagging
4. **Stream optimization**: pdf/screenshot use `.body` pass-through, not `.arrayBuffer()` (memory efficient)
5. **Shape normalization**: /api/clientes handles both `nombre` and `razon_social` variants
6. **Sanitization**: cotizaciones/[id] uses sanitizeCotizacion() to block unexpected fields from bot

---

## Recommendation

**PASS — NO CHANGES REQUIRED**

All 11 endpoints exhibit consistent auth, error handling, and rewrite logic. No security gaps detected. 

### Low-Priority Observations (Not Bugs)
1. **Idempotency cache** is in-memory (single-region). Consider migrating to Vercel KV if multi-region deployment planned (TODO comment already present).
2. **formulario reformat** — pdf/route.ts and screenshot/route.ts parse JSON on 404 for error messages; if backend returns non-JSON binary (corruption), this silent-catches and uses default message (safe).

---

## Files Audited
- src/app/api/cotizaciones/route.ts
- src/app/api/cotizaciones/[id]/route.ts
- src/app/api/cotizaciones/[id]/pdf/route.ts
- src/app/api/cotizaciones/[id]/screenshot/route.ts
- src/app/api/cotizaciones/[id]/excel/route.ts
- src/app/api/cotizaciones/excel/route.ts
- src/app/api/clientes/route.ts
- src/app/api/optimizar/route.ts
- src/app/api/catalogos/equipos/route.ts
- src/app/api/catalogos/planes/route.ts

**Total Lines Audited:** ~1,800 TypeScript LOC
