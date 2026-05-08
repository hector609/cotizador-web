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
  /** URL al PDF cuando completada. Puede ser firmada o pública según backend. */
  pdf_url?: string;
  /** Mensaje legible si falló (no exponer stacktraces). */
  error?: string;
  /** ISO-8601 UTC. */
  created_at: string;
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
