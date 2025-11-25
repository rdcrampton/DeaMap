/**
 * ErrorHandler
 * Maneja errores de dominio y los convierte en respuestas HTTP apropiadas
 * Centraliza el manejo de errores para consistencia en toda la API
 */

import {
  DomainError,
  DeaNotFoundError,
  InvalidVerificationTransitionError,
  InvalidDeaDataError,
  MissingRequiredDataError,
  InvalidOperationError,
  DeaAlreadyExistsError
} from '@/dea-management/domain/errors/DeaErrors';

/**
 * Estructura de respuesta de error
 */
interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Maneja errores y retorna Response HTTP apropiada
 * @param error - Error capturado
 * @returns Response con código de estado y mensaje apropiados
 */
export function handleDomainError(error: unknown): Response {
  console.error('[ErrorHandler]', error);

  // Errores de dominio específicos
  if (error instanceof DeaNotFoundError) {
    return createErrorResponse(
      'No encontrado',
      error.message,
      404
    );
  }

  if (error instanceof DeaAlreadyExistsError) {
    return createErrorResponse(
      'Conflicto',
      error.message,
      409
    );
  }

  if (error instanceof InvalidVerificationTransitionError) {
    return createErrorResponse(
      'Transición de estado inválida',
      error.message,
      409
    );
  }

  if (error instanceof InvalidOperationError) {
    return createErrorResponse(
      'Operación no permitida',
      error.message,
      422
    );
  }

  if (error instanceof InvalidDeaDataError || 
      error instanceof MissingRequiredDataError) {
    return createErrorResponse(
      'Datos inválidos',
      error.message,
      400
    );
  }

  // Error genérico de dominio
  if (error instanceof DomainError) {
    return createErrorResponse(
      'Error de negocio',
      error.message,
      422
    );
  }

  // Error estándar de JavaScript
  if (error instanceof Error) {
    return createErrorResponse(
      'Error de validación',
      error.message,
      400
    );
  }

  // Error completamente inesperado
  return createErrorResponse(
    'Error interno del servidor',
    'Ha ocurrido un error inesperado',
    500
  );
}

/**
 * Crea una respuesta de error estandarizada
 */
function createErrorResponse(
  error: string,
  message: string,
  status: number,
  details?: unknown
): Response {
  const responseBody: ErrorResponse = {
    error,
    message
  };

  if (details) {
    responseBody.details = details;
  }

  return Response.json(responseBody, { status });
}

/**
 * Maneja errores en modo desarrollo vs producción
 * En desarrollo, incluye stack traces
 */
export function handleDomainErrorWithEnv(error: unknown, isDevelopment = false): Response {
  if (isDevelopment && error instanceof Error) {
    console.error('[ErrorHandler] Stack trace:', error.stack);
  }

  return handleDomainError(error);
}
