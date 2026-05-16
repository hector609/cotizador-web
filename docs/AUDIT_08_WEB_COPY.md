# AUDIT_08_WEB_COPY — Inconsistencias Terminología, Precios, Trial

**Auditado:** 2026-05-15 | **Scope:** `C:\dev\cotizador-web\src\app` | **Total issues:** 12

| **Archivo** | **Línea** | **Issue** | **Sugerencia** |
|---|---|---|---|
| `precios/page.tsx` | 46, 64, 83, 100 | Precios hardcoded (`999`, `2499`, `4999`, `399`) sin constante global | Mover a `const PLAN_PRICES = { starter: 999, pro: 2499, ... }` en archivo compartido |
| `precios/page.tsx` | 49, 67, 86, 103 | Trial "14 días" hardcoded sin DRY (aparece en 4 CTAs) | Crear constante `const TRIAL_DAYS = 14` y usar en props/copy |
| `precios/page.tsx` | 52, 70, 89, 108 | Features list mezcla "vendedores" con "Vendedores" inconsistentemente | Estandarizar: **"Hasta X vendedores"** (minúscula, cantidad primero) |
| `dashboard/billing/_BillingPageClient.tsx` | 46–50 | PLAN_PRICES duplicado (copia del precios/page) | Consolidar en archivo constante centralizado (`lib/plans.ts`) |
| `dashboard/billing/_BillingPageClient.tsx` | 134 | Trial "14 días" hardcoded en `TrialProgressBar` | Usar `const TRIAL_DAYS = 14` desde constante global |
| `ayuda/page.tsx` | L176 | "Starter: ... Pro: ... Empresa: ..." sin paréntesis/formato consistent | Usar formato uniforme: **"Starter (hasta 3) · Pro (hasta 10) · Empresa (ilimitados)"** |
| `ayuda/page.tsx` | L161 | Mix "Pro y Empresa" (inconsistente: a veces "planes Pro y Empresa", a veces "Pro, Empresa") | Estandarizar: **"planes Pro y Empresa"** o **"Pro o Empresa"** según contexto |
| `dashboard/clientes/page.tsx` | ~L130 | Plural error `0 clientes en tu cartera` → debería ser "Tu cartera está vacía" | Usar mensaje smart: `total === 0 ? "Tu cartera está vacía" : "X clientes"` |
| `precios/page.tsx` | 723–726 | VendedorTelcel precio "30 días" en texto pero plan usa "14 días" | Auditar si `vendedor_telcel` es 30d (excepción) o mismo 14d que otros |
| `ayuda/page.tsx` | L177 | Inconsistencia "vendedores" (minúscula) vs "Vendedor Telcel" (mayúscula) en mismo párrafo | Usar minúscula consistente: **"vendedor Telcel"** cuando referencia personal |
| `dashboard/billing/_BillingPageClient.tsx` | 53–55 | Features repetidas entre planes sin separador claro ("Todo lo de Starter+" ausente) | Usar bullets separados: `starter: [...]` `pro: ["Todo lo de Starter", "Hasta 10 vendedores", ...]` |
| `precios/page.tsx` | 723 | Precio "Vendedor Telcel" `$399` sin variable | Agregar `vendedor_telcel: 399` a constante global; no hardcodear en JSX |

---

## Recomendaciones Consolidadas

1. **Crear `lib/plans.ts`** con constantes centralizadas:
   ```typescript
   export const TRIAL_DAYS = 14;
   export const PLAN_PRICES = {
     starter: 999,
     pro: 2499,
     empresa: 4999,
     vendedor_telcel: 399,
   };
   export const PLAN_VENDOR_LIMITS = {
     starter: 3,
     pro: 10,
     empresa: null, // ilimitados
   };
   ```

2. **Plurales inteligentes** en componentes que usan contadores:
   ```tsx
   const count = 0;
   const label = count === 0 
     ? "Tu cartera está vacía" 
     : `${count} ${count === 1 ? "cliente" : "clientes"}`;
   ```

3. **Auditar trial period**: VendedorTelcel dice "30 días" en ayuda pero plan usa "14 días"—confirmar cuál es correcto e importar constante.

4. **Distribuidor vs Vendedor**: Usar "distribuidor" (entidad macro, cuenta principal), "vendedor" (usuario dentro de distribuidor).

---

**Estado:** Ready for fix | **Est. fixes:** ~2–3 h | **Impact:** Copy polish + DRY principles
