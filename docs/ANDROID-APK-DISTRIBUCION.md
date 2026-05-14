# Cotizador Android — APK sideload (sin Play Store)

Distribución privada para vendedores. **No requiere cuenta Google Play Console.**

## Generar el APK (1 vez por release, ~30 min)

1. Abre **https://www.pwabuilder.com/**
2. Pega tu URL: `https://cotizador.hectoria.mx`
3. Espera análisis. Score esperado: **100/100 PWA** (manifest + iconos + SW listos).
4. Click **"Package For Stores"** → **"Android"**.
5. Llena el formulario:

   | Campo | Valor |
   |---|---|
   | Package ID | `mx.hectoria.cotizador` |
   | App name | `Cotizador` |
   | Launcher name | `Cotizador` |
   | App version | `1.0.0` (sube al hacer release) |
   | App version code | `1` (entero, sube +1 por release) |
   | Theme color | `#4F46E5` |
   | Background color | `#FFFFFF` |
   | Nav color | `#4F46E5` |
   | Status bar color | `#4F46E5` |
   | Icon URL | `https://cotizador.hectoria.mx/icons/icon-512.png` |
   | Maskable icon URL | `https://cotizador.hectoria.mx/icons/icon-512-maskable.png` |
   | Splash / Monochrome icon | mismo `/icons/icon-512.png` |
   | Display mode | `standalone` |
   | Orientation | `default` (o `portrait` si prefieres) |
   | Signing key | **"Use mine"** → **NO**, dejar **"Create new"** (PWABuilder firma con debug key) |

6. Click **"Download Test Package"** (NO "Production Package" porque ese pide subir a Play Store).
7. Descomprime el zip. Tendrás:
   - `app-release-signed.apk` ← este es el que distribuyes
   - `signing.keystore` + `key.json` ← **GUARDA esto**. Sin estos archivos no podrás firmar updates con la misma identidad. Guárdalos en 1Password / Bitwarden.

## Subir el APK al dominio

```bash
# Tu APK descargado:
cp ~/Downloads/PWABuilder/app-release-signed.apk \
   C:/dev/cotizador-web/public/cotizador.apk
```

Commit + push → Vercel deploya → queda en `https://cotizador.hectoria.mx/cotizador.apk`.

## Instrucciones para vendedores (cópialas en WhatsApp/Email)

> **Instalar Cotizador en tu Android (3 minutos)**
>
> 1. Desde el celular, abre Chrome y entra a **https://cotizador.hectoria.mx/descargar**
> 2. Toca **"Descargar APK"** (es seguro, es nuestra app).
> 3. Android te avisará: *"Este tipo de archivo puede dañar tu dispositivo"* → toca **Aceptar**.
> 4. Abre el APK desde tus descargas.
> 5. Android te pedirá permiso: *"Permitir esta fuente"* → tócalo → activa el toggle → regresa.
> 6. Toca **Instalar**.
> 7. Listo. Ya tienes el icono Cotizador en tu home.
>
> Si algo falla, escríbenos a soporte@hectoria.mx.

## Actualizar a v2 (cuando saquemos cambios)

1. Cambia `App version code` a `2` (+ 1 cada release) y `App version` a `1.1.0`.
2. Regenera el APK en PWABuilder con la **MISMA signing key** (sube el `signing.keystore` y `key.json` que guardaste).
3. Reemplaza `public/cotizador.apk` y push.
4. Avisa a los vendedores que bajen y reinstalen (Android conserva los datos si la firma coincide).

**IMPORTANTE:** si firmas con una key distinta, Android rechaza el update con error. Por eso GUARDA el keystore como tesoro.

## Limitaciones conocidas

- **Sin auto-update.** Los vendedores tienen que bajar APK nuevo manualmente. Aceptable para 5-10 usuarios piloto; si llegan a 50+ migrar a Play Store.
- **"Fuentes desconocidas".** Android exige confirmar permiso la primera vez. UX un poco fea pero no es bloqueante.
- **No reviews / no Google Pay.** Si en algún momento monetizas dentro de la app, considera Play Store.
- **Sin push notifications nativas.** El TWA hereda la API Push del navegador (limitada en Android Chrome). Para push reales tipo "tu cotización está lista" mientras el teléfono está bloqueado → migrar a Capacitor.

## Cuando migrar a Play Store (futuro)

Cuando tengas 20+ vendedores, querrás:
- Auto-update (Play Store maneja diff updates)
- Verified TWA sin barra de URL de Chrome encima
- Identidad pública (Cotizador en Play Store da confianza al cliente final del vendedor)

Costo: $25 USD una vez (Play Console) + tener listo `public/.well-known/assetlinks.json` con el SHA-256 de la signing key uploaded. PWABuilder soporta este flujo con **"Production Package"** en vez de "Test Package".
