/**
 * Errores de Dominio
 * Errores específicos del contexto de gestión de DEAs
 * Permiten un manejo de errores tipado y específico
 */

/**
 * Clase base para todos los errores de dominio
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error cuando no se encuentra un DEA
 */
export class DeaNotFoundError extends DomainError {
  constructor(identifier: string | number) {
    super(`DEA no encontrado: ${identifier}`);
  }
}

/**
 * Error cuando el código DEA es inválido
 */
export class InvalidDeaCodeError extends DomainError {
  constructor(code: string, reason: string) {
    super(`Código DEA inválido '${code}': ${reason}`);
  }
}

/**
 * Error cuando la ubicación es inválida
 */
export class InvalidLocationError extends DomainError {
  constructor(reason: string) {
    super(`Ubicación inválida: ${reason}`);
  }
}

/**
 * Error cuando se intenta una transición de estado inválida
 */
export class InvalidVerificationTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(
      `Transición de estado inválida: no se puede cambiar de '${from}' a '${to}'`
    );
  }
}

/**
 * Error cuando los datos del DEA son inválidos
 */
export class InvalidDeaDataError extends DomainError {
  constructor(field: string, reason: string) {
    super(`Datos de DEA inválidos en campo '${field}': ${reason}`);
  }
}

/**
 * Error cuando se intenta una operación no permitida en el estado actual
 */
export class InvalidOperationError extends DomainError {
  constructor(operation: string, currentState: string) {
    super(
      `Operación '${operation}' no permitida en el estado actual '${currentState}'`
    );
  }
}

/**
 * Error cuando el DEA ya existe
 */
export class DeaAlreadyExistsError extends DomainError {
  constructor(identifier: string) {
    super(`Ya existe un DEA con el identificador: ${identifier}`);
  }
}

/**
 * Error cuando faltan datos requeridos
 */
export class MissingRequiredDataError extends DomainError {
  constructor(field: string) {
    super(`Falta el campo requerido: ${field}`);
  }
}
