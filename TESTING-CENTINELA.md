# Testing Centinela Web Error Reporting

## Local E2E Test

### 1. Start Backend (cotizador-telcel)
```bash
cd /c/dev/cotizador-telcel
python cotizador_bot.py  # Arranca api_server en thread daemon
```

### 2. Start Frontend (cotizador-web)
```bash
cd /c/dev/cotizador-web
npm run dev  # Arranca en http://localhost:3000
```

### 3. Trigger Error in Browser

Option A: Manual via Console
```javascript
// En browser console (F12 → Console tab)
throw new Error("Test error from console — Centinela should report this");
```

Expected: 
- Error boundary muestra UI empática ("Algo salió mal")
- El error se reporta a `/api/centinela/report-error`
- Backend escribe a `data/errors.jsonl`

Option B: Via Page Component
Edit any page (e.g., `src/app/dashboard/page.tsx`) para que lance un error:
```tsx
export default function Dashboard() {
  throw new Error("Test error in component");
  // ...
}
```

### 4. Validate Backend Receipt

Check backend logs (stdout):
```
[Centinela logged web_error: Test error in component at /dashboard]
```

Check file:
```bash
tail -5 /c/dev/cotizador-telcel/data/errors.jsonl
# Debería mostrar JSON line con:
# {
#   "timestamp": "2026-05-15T...",
#   "event_type": "web_error",
#   "source": "web",
#   "route": "/dashboard",
#   "error_message": "Test error in component",
#   ...
# }
```

## Shape Validation

Frontend Client Error Report:
```json
{
  "source": "web",
  "route": "/dashboard",
  "error_message": "...",
  "stack": "...",     // optional
  "digest": "..."      // optional
}
```

Backend Recorded (errors.jsonl):
```json
{
  "timestamp": "2026-05-15T10:30:00Z",
  "event_type": "web_error",
  "source": "web",
  "route": "/dashboard",
  "error_message": "...",     // max 200 chars
  "stack": "...",             // max 500 chars, optional
  "digest": "...",
  "user_agent": "...",        // max 100 chars
  "client_ip": "203.0.113.42"
}
```

## Throttling Validation

Trigger 6+ errors rapidly in browser console:
```javascript
for (let i = 0; i < 10; i++) {
  throw new Error(`Error ${i}`);
}
```

Expected: Only first 5 errors reported per minute (throttle: 60s reset window).

## API Proxy Validation

POST to `/api/centinela/report-error` should:
- Accept JSON with error details
- Validate X-Auth HMAC (computed with SESSION_SECRET)
- Forward to backend `/api/v1/centinela/report-error`
- Return 204 No Content always (no info leak)

Example curl (valid HMAC):
```bash
PAYLOAD='{"source":"web","route":"/","error_message":"test"}'
SECRET="dev-secret"
HMAC=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')
curl -X POST http://localhost:3000/api/centinela/report-error \
  -H "Content-Type: application/json" \
  -H "X-Auth: v1 $HMAC" \
  -d "$PAYLOAD"
# Response: 204 No Content
```

Invalid HMAC:
```bash
curl -X POST http://localhost:3000/api/centinela/report-error \
  -H "Content-Type: application/json" \
  -H "X-Auth: v1 wrong-signature" \
  -d "$PAYLOAD"
# Response: 204 No Content (no leak)
```

## Server Action Error Capture

Use `withErrorReporting` wrapper in server actions:
```tsx
// src/app/api/example/action.ts
"use server"
import { withErrorReporting } from "@/lib/with-error-reporting";

export async function myServerAction() {
  return withErrorReporting(async () => {
    // code that might throw
    throw new Error("Server-side error");
  }, "/api/example");
}
```

Expected: Error logged server-side → reported to backend → thrown to client UI.
