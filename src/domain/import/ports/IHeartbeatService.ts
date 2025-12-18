/**
 * Puerto: Servicio de heartbeat para procesos de larga duración
 * Capa de Dominio - Interface para mantener vivos los procesos
 */

/**
 * Información de un batch con heartbeat stale (posiblemente interrumpido)
 */
export interface StaleBatchInfo {
  batchId: string;
  lastHeartbeat: Date;
  status: string;
  totalRecords: number;
  processedRecords: number;
  staleDurationMs: number;
}

/**
 * Puerto: Servicio de heartbeat
 * Implementación: PrismaHeartbeatService
 *
 * Mantiene un timestamp actualizado periódicamente durante
 * procesos largos para detectar interrupciones
 */
export interface IHeartbeatService {
  /**
   * Inicia el heartbeat automático para un batch
   * Actualiza el timestamp periódicamente en background
   *
   * @param batchId ID del batch de importación
   * @param intervalMs Intervalo entre actualizaciones (default: 30000ms)
   */
  start(batchId: string, intervalMs?: number): void;

  /**
   * Detiene el heartbeat automático
   * Debe llamarse siempre al terminar el proceso (success o error)
   */
  stop(): void;

  /**
   * Actualiza el heartbeat manualmente (pulse)
   * Útil para operaciones que necesitan control más fino
   */
  pulse(): Promise<void>;

  /**
   * Verifica si el heartbeat está activo
   *
   * @returns true si está corriendo
   */
  isActive(): boolean;

  /**
   * Obtiene el ID del batch actual
   *
   * @returns ID del batch o null si no está activo
   */
  getCurrentBatchId(): string | null;

  /**
   * Detecta batches con heartbeat stale (posiblemente interrumpidos)
   * Útil para recuperación automática o alertas
   *
   * @param thresholdMs Tiempo sin heartbeat para considerar stale (default: 60000ms)
   * @returns Array de batches stale con información
   */
  findStaleBatches(thresholdMs?: number): Promise<StaleBatchInfo[]>;

  /**
   * Verifica si un batch específico está stale
   *
   * @param batchId ID del batch
   * @param thresholdMs Tiempo sin heartbeat para considerar stale
   * @returns true si está stale
   */
  isStale(batchId: string, thresholdMs?: number): Promise<boolean>;

  /**
   * Marca un batch como interrumpido
   * Actualiza el estado para que pueda ser reanudado
   *
   * @param batchId ID del batch
   */
  markAsInterrupted(batchId: string): Promise<void>;
}

/**
 * Factory para crear instancias de HeartbeatService
 * Útil para crear servicios con diferentes configuraciones
 */
export interface IHeartbeatServiceFactory {
  /**
   * Crea una nueva instancia del servicio de heartbeat
   *
   * @param batchId ID del batch
   * @param intervalMs Intervalo de heartbeat (opcional)
   * @returns Nueva instancia del servicio
   */
  create(batchId: string, intervalMs?: number): IHeartbeatService;
}
