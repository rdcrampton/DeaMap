/**
 * Instrumentation for Next.js 16
 * Ejecuta código al iniciar el servidor
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // La recuperación de batch jobs ahora se maneja mediante:
  // - POST /api/batch/recover - Recupera jobs con timeout
  // - GET /api/batch/recover - Lista jobs resumibles
  // No es necesario ejecutar recuperación automática al iniciar
}
