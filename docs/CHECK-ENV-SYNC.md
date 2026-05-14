# Check Environment Variables Sync

Script que detecta env vars vacías o mal formadas en Vercel ANTES de que rompan producción.

## Uso

```bash
npm run check-env
```

O directamente:

```bash
node scripts/check-env-sync.mjs
```

## Comportamiento

1. Lee el token de Vercel desde:
   - `~/.local/share/com.vercel.cli/auth.json` (Linux/macOS)
   - `%USERPROFILE%/AppData/Roaming/com.vercel.cli/Data/auth.json` (Windows)
   - Variable de entorno `VERCEL_TOKEN`

2. Hace `GET /v9/projects/cotizador-web/env?decrypt=true` para listar variables

3. Valida que estas env vars CRÍTICAS existan y tengan formato correcto:
   - `SESSION_SECRET` (64+ caracteres hex)
   - `BOT_API_URL` (debe ser `https://cmdemobot.fly.dev`)
   - `ANTHROPIC_API_KEY` (debe empezar con `sk-ant-`)
   - `TELEGRAM_BOT_TOKEN` (formato `/^\d+:[\w-]+$/`)
   - `WEBHOOK_SECRET` (64+ caracteres hex)
   - `NEXT_PUBLIC_APP_URL` (URL válida)

4. **Exit code 0** si todas OK → ✅
5. **Exit code 1** si alguna está vacía/mal formada → ❌ + comando `vercel env add` o curl API

## Cuándo correrlo

- **Después de cada deploy** en CI/CD
- **Antes de release** a producción
- **En PR reviews** si se tocan secrets
- **Manualmente** ante sospecha de env vars rotos

## Instalación de Vercel CLI

Si `vercel login` no funciona, obtén el token manualmente:

```bash
vercel link
# Luego copia el token de ~/.vercelrc o AppData/Roaming/com.vercel.cli/Data/auth.json
```

O setea directamente:

```bash
export VERCEL_TOKEN=<token-aqui>
npm run check-env
```

## Ejemplo de salida

**TODO OK:**
```
✅ SESSION_SECRET
✅ BOT_API_URL
✅ ANTHROPIC_API_KEY
✅ TELEGRAM_BOT_TOKEN
✅ WEBHOOK_SECRET
✅ NEXT_PUBLIC_APP_URL

✅ All critical environment variables are OK.
```

**Con error:**
```
❌ SESSION_SECRET is EMPTY in Vercel production

Fix:
  vercel env add SESSION_SECRET
  # or via API:
  curl -X POST https://api.vercel.com/v10/projects/cotizador-web/env \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"key":"SESSION_SECRET","value":"<paste-here>","target":["production","preview"]}'
```

## Dependencias

- `node:fs` (nativo)
- `node:https` (nativo)
- `node:path` (nativo)

Sin dependencias NPM adicionales.
