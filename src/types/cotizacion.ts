/**
 * Tipos compartidos para el flujo de cotización web.
 *
 * El RFC se trata como opcional para permitir cotizaciones "sin base"
 * (sin cliente registrado en el portal del operador). Pasos posteriores
 * del backend pueden rechazarlas según la política del tenant.
 */

export type EstadoCotizacion = "pendiente" | "completada" | "fallida";

/**
 * Un perfil dentro de una cotización multi-equipo. Permite mezclar varios
 * modelos en la misma orden contra el mismo cliente (RFC). El backend mapea
 * cada perfil a una entrada del array `--perfiles` que cotizar.js espera.
 */
export interface PerfilCotizacion {
  /** Equipo (label legible — "iPhone 15", "Samsung Galaxy S24", "Sin equipo"). */
  equipo: string;
  /** Líneas asignadas a este perfil (1-500). */
  lineas: number;
  /** Cantidad de equipos de este perfil (0..lineas, 0 si "Sin equipo"). */
  equipos_qty: number;
}

export interface Cotizacion {
  /** UUID generado por el backend (NO confiar en IDs provistos por el cliente). */
  id: string;
  /** RFC del cliente. Opcional cuando se cotiza sin base. */
  rfc?: string;
  /** Número de líneas (1-500 single, suma total en multi-perfil). */
  lineas: number;
  /** Plan mensual por línea en MXN (100-5000) — solo aplica en single-perfil. */
  plan: number;
  /** Equipo seleccionado (single) o resumen del primer perfil (multi). */
  equipo?: string;
  /** Cantidad de equipos (single) o suma total en multi. */
  equipos_qty: number;
  /** Estado del job de Playwright en backend. */
  estado: EstadoCotizacion;
  /**
   * URL al PDF cliente cuando completada. El proxy `/api/cotizaciones/[id]`
   * reescribe el path relativo del backend (`/api/v1/cotizaciones/<id>/pdf`)
   * a un path del frontend (`/api/cotizaciones/<id>/pdf?formato=cliente`)
   * que streamea el binario vía el route handler `pdf/route.ts`.
   */
  pdf_url?: string;
  /**
   * URL al PDF interno (rentabilidad) cuando completada y disponible.
   * Mismo esquema de reescritura que `pdf_url`, con `?formato=interno`.
   * Solo presente si el bot generó este PDF en el run (no siempre aplica).
   */
  pdf_url_interno?: string;
  /**
   * URL a la captura (PNG) del resumen Telcel cuando la cotización es un
   * BORRADOR (sin RFC) y por tanto el portal NO emite PDF oficial. El
   * backend devuelve un path relativo `/api/v1/cotizaciones/<id>/screenshot`
   * y este frontend lo reescribe al proxy `/api/cotizaciones/<id>/screenshot`
   * que streamea el image/png con X-Auth firmado. Cuando exista `pdf_url`
   * suele estar ausente; cuando no hay PDF, este campo es la única evidencia
   * descargable del run.
   */
  screenshot_url?: string;
  /** Mensaje legible si falló (no exponer stacktraces). */
  error?: string;
  /** ISO-8601 UTC. */
  created_at: string;
  /**
   * Rentabilidad A/B real devuelta por el backend (string como "22.5%" o "22.5").
   * Solo presente en cotizaciones completadas donde el bot la calculó.
   */
  rentabilidad?: string;
  /**
   * Lista de perfiles cuando la cotización es multi-equipo. Solo presente si
   * el POST original incluyó `perfiles[]`; en single-perfil queda undefined.
   */
  perfiles?: PerfilCotizacion[];
  /**
   * Nombre del plan global (string como "TELCEL EMPRESA BASE") cuando viene
   * del shape multi-perfil. En single-perfil el plan se modela como número
   * MXN en el campo `plan` y este campo queda undefined.
   */
  plan_global?: string;
}

export interface CrearCotizacionInput {
  /** Validar contra `^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$` antes de enviar. */
  rfc?: string;
  /**
   * Single-perfil legacy: estos cuatro campos son requeridos cuando NO se
   * envía `perfiles[]`. El backend acepta este shape por compat.
   */
  lineas?: number;
  plan?: number;
  equipo?: string;
  equipos_qty?: number;
  /**
   * Multi-perfil: lista de 1..10 perfiles. Total de líneas combinadas ≤ 1000.
   * Cuando se envía, los campos legacy de arriba se ignoran (el backend
   * deriva el resumen de la lista).
   */
  perfiles?: PerfilCotizacion[];
  /** Nombre del plan global (string) — opcional, solo aplica en multi-perfil. */
  plan_global?: string;
}

export interface ListarCotizacionesResponse {
  cotizaciones: Cotizacion[];
  total: number;
  limit: number;
  offset: number;
}

/** Respuesta del POST. El backend regresa la cotización recién creada. */
export interface CrearCotizacionResponse {
  cotizacion: Cotizacion;
}

/** Regex oficial RFC México (personas físicas y morales). */
export const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
