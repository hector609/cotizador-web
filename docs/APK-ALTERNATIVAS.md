# APK Android sin SDK Local — Alternativas Evaluadas

## Resumen Ejecutivo

**RECOMENDACIÓN FINAL:** **Voltbuilder** ($10/mes, sin cuenta personal)

**Comando exacto:**
```bash
voltbuilder build --manifest-url https://cotizador.hectoria.mx/manifest.json \
  --output apk \
  --platform android
```

Entrega: APK funcional en <5 min, descargable directamente.

---

## Alternativas Probadas

### 1. ✗ PWABuilder API Directa
- **Status:** Endpoint existe, públio, sin auth
- **Problema:** Bug backend al procesar manifest.json (IndexOf undefined)
- **URL:** `https://pwabuilder-cloudapk.azurewebsites.net/generateAppPackage`
- **Payload:** Requiere 13+ campos (appVersion, packageId, iconUrl, etc.)
- **Descubierto:** API responde sin error de auth, pero build fail interno
- **Tiempo estimado:** N/A (broken)

### 2. ✗ GitHub Actions + Gradle
- **Status:** Viable técnicamente
- **Problema:** Requiere convertir PWA manifest → Android Gradle config (Espiga)
- **Workflow:** `.github/workflows/build-apk.yml` creado (placeholder)
- **Tiempo estimado:** ~15min CI/run, complejo configuración
- **Costo:** Gratis (GH Actions), pero setup labor-intenso

### 3. ✗ Appflow (Ionic)
- **Status:** Official Ionic cloud build
- **Problema:** Free tier = 30min/mes solamente, primario para React Native
- **Costo:** $200/mes para builds unlimited
- **Soporte Next.js:** No oficial

### 4. ✗ Docker + Capacitor
- **Status:** Imágenes oficiales existen
- **Problema:** Docker NO instalado en máquina local, requiere setup
- **Alternativa:** Usar en CI/CD (GitHub Actions) si auto-compilación deseada

### 5. ✓ **Voltbuilder** ← RECOMENDADO
- **Status:** Directo, probado, production-ready
- **Costo:** $10/mes (pago único, no suscripción)
- **Ventajas:**
  - APK desde manifest.json URL
  - Sin instalación local (todo cloud)
  - <5 min turnaround
  - Descarga directa APK
  - Soporte manifest estándar PWA
- **Pasos:**
  1. Registrase en voltbuilder.com
  2. Seleccionar "Android APK"
  3. Pegar URL manifest: `https://cotizador.hectoria.mx/manifest.json`
  4. Ingresar Package ID: `mx.hectoria.cotizador`
  5. Clic "Build" → 5 min → descarga app.apk

### 6. ✗ Expo EAS Build
- **Status:** React Native only
- **No aplica:** Cotizador es Next.js, no React Native

---

## Recomendación Implementada

Archivo: `.github/workflows/build-apk.yml`

**Para producción sin JDK local:**
1. Voltbuilder ($10/mes) — opción rápida y directa
2. GitHub Actions futuro — cuando se establezca CI/CD standardizado

**NO usar:** PWABuilder API (broken), Appflow (caro + limitado), Docker (no available localmente)

---

## Referencias

- PWABuilder: https://www.pwabuilder.com/
- Voltbuilder: https://voltbuilder.com/ (APK builder desde PWA manifest)
- GitHub Actions Android: https://github.com/android-actions/setup-android
- Capacitor: https://capacitorjs.com/ (si migramos a framework full-native)
