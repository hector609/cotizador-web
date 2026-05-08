/**
 * Tipos compartidos para el flujo de cotización web.
 *
 * El RFC se trata como opcional para permitir cotizaciones "sin base"
 * (sin cliente registrado en el portal del operador). Pasos posteriores
 * del backend pueden rechazarlas según la política del tenant.
 */

export type EstadoCotizacion = "pendiente" | "completada" | "fallida";

export interface Cotizacion {
  /** UUID generado por el backend (NO confiar en IDs provistos por el cliente). */
  id: string;
  /** RFC del cliente. Opcional cuando se cotiza sin base. */
  rfc?: string;
  /** Número de líneas (1-500). */
  lineas: number;
  /** Plan mensual por línea en MXN (100-5000). */
  plan: number;
  /** Equipo seleccionado (label libre o "Sin equipo"). */
  equipo?: string;
  /** Cantidad de equipos (≤ líneas, 0 si "Sin equipo"). */
  equipos_qty: number;
  /** Estado del job de Playwright en backend. */
  estado: EstadoCotizacion;
  /** URL al PDF cuando completada. Puede ser firmada o pública según backend. */
  pdf_url?: string;
  /** Mensaje legible si falló (no exponer stacktraces). */
  error?: string;
  /** ISO-8601 UTC. */
  created_at: string;
}

export interface CrearCotizacionInput {
  /** Validar contra `^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$` antes de enviar. */
  rfc?: string;
  lineas: number;
  plan: number;
  equipo?: string;
  equipos_qty: number;
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
