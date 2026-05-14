# Cotizador Android — APK sideload (sin Play Store)

Distribución privada para vendedores. **No requiere cuenta Google Play Console.**

## Generar el APK — 5 clics en PWABuilder (10 min)

> **Por qué PWABuilder:** Bubblewrap CLI no corre en Node 24 (incompatibilidad minizlib).
> Android SDK pesa 5+ GB. PWABuilder hace exactamente lo mismo en la nube, gratis.

### Paso a paso

**1. Abre** https://www.pwabuilder.com/  
   → Pega `https://cotizador.hectoria.mx` → **Start**

**2. Espera el análisis** (10–30 seg).  
   Score esperado: **100/100** (manifest + SW + iconos ya están listos).

**3. Click "Package For Stores"** → elige **"Android"**

**4. Rellena el formulario** con estos valores exactos:

| Campo | Valor |
|---|---|
| Package ID | `mx.hectoria.cotizador` |
| App name | `Cotizador` |
| Launcher name | `Cotizador` |
| App version | `1.0.0` |
| App version code | `1` |
| Theme color | `#4F46E5` |
| Background color | `#FFFFFF` |
| Nav color | `#4F46E5` |
| Status bar color | `#4F46E5` |
| Icon URL | `https://cotizador.hectoria.mx/icons/icon-512.png` |
| Maskable icon URL | `https://cotizador.hectoria.mx/icons/icon-512-maskable.png` |
| Display mode | `standalone` |
| Signing key | dejar **"Create new"** (PWABuilder firma con debug key) |

**5. Click "Download Test Package"** (NO "Production Package").  
   → Descarga un `.zip` con `app-release-signed.apk` dentro.

### Después de descargar

```bash
# Descomprime el zip y copia:
cp ~/Downloads/app-release-signed.apk C:/dev/cotizador-web/public/cotizador.apk
```

Luego en el repo:
```bash
git add public/cotizador.apk
git commit -m "feat(android): APK sideload v1.0.0 (mx.hectoria.cotizador)"
# NO hacer push automático — validar primero en un Android real
git push
```

Vercel desplegará el APK en `https://cotizador.hectoria.mx/cotizador.apk`.

**GUARDA** el `signing.keystore` y `key.json` del zip en 1Password/Bitwarden.  
Sin estos no puedes firmar updates con la misma identidad (Android rechaza reinstalaciones con key distinta).

---

## Instrucciones para vendedores (copia en WhatsApp/Email)

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

---

## Actualizar a v2

1. En PWABuilder cambia `App version code` a `2`, `App version` a `1.1.0`.
2. **Sube el mismo `signing.keystore` + `key.json`** que guardaste (opción "Use mine").
3. Descarga nuevo zip → copia `app-release-signed.apk` → reemplaza `public/cotizador.apk` → push.
4. Avisa a vendedores que reinstalen. Android conserva datos si la firma coincide.

---

## Limitaciones conocidas

- **Sin auto-update.** Vendedores bajan APK nuevo manualmente. Aceptable para 5–10 usuarios piloto.
- **"Fuentes desconocidas".** Android pide confirmar permiso la primera vez. No es bloqueante.
- **Sin Google Pay.** Si monetizas en-app en el futuro, considera Play Store.

## Cuando migrar a Play Store

Con 20+ vendedores conviene Play Store: auto-update, TWA verificado sin barra de Chrome, identidad pública.  
Costo: $25 USD una vez. Usa **"Production Package"** en PWABuilder y sube el `signing.keystore` existente.
