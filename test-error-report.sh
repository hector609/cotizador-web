#!/bin/bash
# test-error-report.sh — test manual E2E de reporte de errores

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
SESSION_SECRET="${SESSION_SECRET:-dev-secret}"

echo "Testing error report E2E..."
echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"
echo ""

# 1. Crear payload de error
PAYLOAD=$(cat <<'EOF'
{
  "source": "web",
  "route": "/dashboard/clientes",
  "error_message": "TypeError: Cannot read properties of undefined (reading 'map')",
  "stack": "at Array.map (<anonymous>)\n    at ClientListComponent (page.tsx:42:15)",
  "digest": "test-digest-abc123",
  "user_agent": "Mozilla/5.0 (X11; Linux x86_64) Test"
}
EOF
)

echo "Payload:"
echo "$PAYLOAD" | jq .
echo ""

# 2. Computar HMAC (bash)
compute_hmac() {
  local secret="$1"
  local payload="$2"
  echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" | awk '{print $NF}'
}

# Normalizar JSON para HMAC (sort keys, compact)
PAYLOAD_NORMALIZED=$(echo "$PAYLOAD" | jq -c --sort-keys .)
HMAC=$(compute_hmac "$SESSION_SECRET" "$PAYLOAD_NORMALIZED")

echo "HMAC Signature: $HMAC"
echo ""

# 3. POST al proxy frontend /api/centinela/report-error
echo "Posting to frontend /api/centinela/report-error..."
RESP=$(curl -X POST \
  "$FRONTEND_URL/api/centinela/report-error" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -s -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)

echo "Response HTTP $HTTP_CODE"
echo "$BODY" | head -5
echo ""

if [ "$HTTP_CODE" = "204" ]; then
  echo "✓ Frontend proxy responded 204 (No Content) as expected"
else
  echo "✗ Unexpected HTTP code: $HTTP_CODE"
  exit 1
fi

echo ""
echo "Test complete. Check backend logs and data/errors.jsonl for the written error."
