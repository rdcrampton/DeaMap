/**
 * Puerto: Servicio de checkpoints para importaciones resumibles
 * Capa de Dominio - Interface para gestión de puntos de recuperación
 */

import type { CheckpointData, CheckpointStats } from "../value-objects/CheckpointData";

/**
 * Puerto: Servicio de checkpoints
 * Implementación: PrismaCheckpointService
 *
 * Permite guardar progreso granular durante importaciones
 * y reanudar desde el último punto en caso de interrupción
 */
export interface ICheckpointService {
  /**
   * Guarda un checkpoint de progreso para un registro
   *
   * @param checkpoint Datos del checkpoint
   */
  save(checkpoint: CheckpointData): Promise<void>;

  /**
   * Guarda múltiples checkpoints en una transacción (batch)
   * Más eficiente para guardar varios a la vez
   *
   * @param checkpoints Array de checkpoints a guardar
   */
  saveBatch(checkpoints: CheckpointData[]): Promise<void>;

  /**
   * Obtiene el último índice procesado para un batch
   * Útil para determinar desde dónde reanudar
   *
   * @param batchId ID del batch de importación
   * @returns Último índice procesado (-1 si no hay checkpoints)
   */
  getLastIndex(batchId: string): Promise<number>;

  /**
   * Obtiene estadísticas de checkpoints para un batch
   *
   * @param batchId ID del batch de importación
   * @returns Estadísticas (total, success, failed, skipped)
   */
  getStats(batchId: string): Promise<CheckpointStats>;

  /**
   * Verifica si un registro específico ya fue procesado
   *
   * @param batchId ID del batch de importación
   * @param recordIndex Índice del registro
   * @returns true si ya fue procesado
   */
  isProcessed(batchId: string, recordIndex: number): Promise<boolean>;

  /**
   * Busca si existe un registro con el mismo hash (duplicado en mismo batch)
   *
   * @param batchId ID del batch de importación
   * @param contentHash Hash del contenido del registro
   * @returns true si existe duplicado
   */
  hasDuplicateHash(batchId: string, contentHash: string): Promise<boolean>;

  /**
   * Obtiene los índices de registros que fallaron
   * Útil para reintentar solo los fallidos
   *
   * @param batchId ID del batch de importación
   * @returns Array de índices de registros fallidos
   */
  getFailedIndices(batchId: string): Promise<number[]>;

  /**
   * Obtiene los datos de un checkpoint específico
   * Útil para recuperar el registro original y reintentarlo
   *
   * @param batchId ID del batch de importación
   * @param recordIndex Índice del registro
   * @returns Datos del checkpoint o null si no existe
   */
  getCheckpoint(batchId: string, recordIndex: number): Promise<CheckpointData | null>;

  /**
   * Limpia todos los checkpoints de un batch
   * Útil después de completar exitosamente o al cancelar
   *
   * @param batchId ID del batch de importación
   * @returns Número de checkpoints eliminados
   */
  cleanup(batchId: string): Promise<number>;

  /**
   * Limpia checkpoints anteriores a cierta fecha
   * Útil para mantenimiento periódico
   *
   * @param olderThan Fecha límite
   * @returns Número de checkpoints eliminados
   */
  cleanupOlderThan(olderThan: Date): Promise<number>;
}
