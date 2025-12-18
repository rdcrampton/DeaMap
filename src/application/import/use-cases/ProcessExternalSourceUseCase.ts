/**
 * Use Case: Procesar sincronización desde fuente de datos externa
 * Capa de Aplicación - Soporta CKAN API, JSON, y otras fuentes
 *
 * Este use case implementa el flujo completo de sincronización:
 * 1. Obtiene registros de la fuente externa
 * 2. Compara con registros existentes (reconciliación)
 * 3. Ejecuta acciones: CREATE, UPDATE, SKIP, DEACTIVATE
 * 4. Gestiona checkpoints para recuperación
 */

import type { IImportRepository } from "@/domain/import/ports/IImportRepository";
import type { IDataSourceRepository } from "@/domain/import/ports/IDataSourceRepository";
import type { ICheckpointService } from "@/domain/import/ports/ICheckpointService";
import type { IHeartbeatService } from "@/domain/import/ports/IHeartbeatService";
import type { IDataSourceAdapter } from "@/domain/import/ports/IDataSourceAdapter";
import type { ImportRecord } from "@/domain/import/value-objects/ImportRecord";
import {
  ReconciliationAction,
  type ReconciliationActionType,
} from "@/domain/import/value-objects/ReconciliationAction";
import { Checkpoint } from "@/domain/import/value-objects/CheckpointData";
import { buildDataSourceConfig } from "@/infrastructure/import/adapters/buildAdapterConfig";

// ============================================
// Request & Response Types
// ============================================

export interface ProcessExternalSourceRequest {
  dataSourceId: string;
  importedBy: string;
  options?: ProcessingOptions;
}

export interface ProcessingOptions {
  dryRun?: boolean; // No crear/modificar registros, solo simular
  forceFullSync?: boolean; // Ignorar checkpoints, procesar todo
  maxRecords?: number; // Límite de registros a procesar
  checkpointFrequency?: number; // Guardar checkpoint cada N registros
  heartbeatIntervalMs?: number; // Intervalo de heartbeat (ms)
  updateExistingFields?: string[]; // Campos a actualizar en registros existentes
  deactivateMissing?: boolean; // Desactivar registros no encontrados en fuente
}

export interface ProcessExternalSourceResponse {
  success: boolean;
  batchId: string;
  dataSourceId: string;
  dryRun: boolean;
  stats: SyncStats;
  errors: SyncError[];
  duration: {
    totalMs: number;
    fetchMs: number;
    processMs: number;
  };
}

export interface SyncStats {
  totalRecords: number;
  created: number;
  updated: number;
  skipped: number;
  deactivated: number;
  failed: number;
}

export interface SyncError {
  recordIndex: number;
  externalId?: string;
  action: ReconciliationActionType;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Use Case Implementation
// ============================================

export class ProcessExternalSourceUseCase {
  constructor(
    private readonly importRepository: IImportRepository,
    private readonly dataSourceRepository: IDataSourceRepository,
    private readonly checkpointService: ICheckpointService,
    private readonly heartbeatService: IHeartbeatService,
    private readonly adapterFactory: (type: string) => IDataSourceAdapter
  ) {}

  async execute(request: ProcessExternalSourceRequest): Promise<ProcessExternalSourceResponse> {
    const startTime = Date.now();
    const { dataSourceId, importedBy, options = {} } = request;

    const {
      dryRun = false,
      forceFullSync = false,
      maxRecords,
      checkpointFrequency = 50,
      heartbeatIntervalMs = 10000,
      deactivateMissing = false,
    } = options;

    // 1. Obtener configuración de la fuente de datos
    console.log(`📥 Starting sync for data source: ${dataSourceId}`);
    const dataSource = await this.dataSourceRepository.findById(dataSourceId);

    if (!dataSource) {
      throw new Error(`Data source not found: ${dataSourceId}`);
    }

    if (!dataSource.isActive) {
      throw new Error(`Data source is not active: ${dataSource.name}`);
    }

    // 2. Crear batch de importación
    const batchId = await this.importRepository.createBatch({
      name: `Sync: ${dataSource.name} - ${new Date().toISOString()}`,
      description: `Automatic sync from ${dataSource.type}`,
      sourceOrigin: dataSource.sourceOrigin,
      fileName: dataSource.name,
      totalRecords: 0, // Se actualizará durante el proceso
      importedBy,
      dataSourceId,
    });

    console.log(`📦 Created import batch: ${batchId}`);

    // 3. Iniciar heartbeat
    if (!dryRun) {
      this.heartbeatService.start(batchId, heartbeatIntervalMs);
    }

    const stats: SyncStats = {
      totalRecords: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      deactivated: 0,
      failed: 0,
    };
    const errors: SyncError[] = [];
    let fetchDuration = 0;
    let processDuration = 0;

    try {
      // 4. Obtener último checkpoint (si no es full sync)
      let startFromIndex = 0;
      if (!forceFullSync) {
        startFromIndex = await this.checkpointService.getLastIndex(batchId);
        if (startFromIndex > 0) {
          console.log(`🔄 Resuming from checkpoint index: ${startFromIndex}`);
        }
      }

      // 5. Obtener adapter y configuración
      const adapter = this.adapterFactory(dataSource.type);
      const config = buildDataSourceConfig(dataSource.type as any, dataSource.config);

      // 6. Obtener conteo total (para progreso)
      const fetchStart = Date.now();
      const totalCount = await adapter.getRecordCount(config);
      console.log(`📊 Total records in source: ${totalCount}`);
      fetchDuration = Date.now() - fetchStart;

      await this.importRepository.updateBatchStatus(batchId, "IN_PROGRESS", {
        totalRecords: totalCount,
      });

      // 7. Obtener referencias externas actuales (para detectar eliminados)
      const existingReferences = deactivateMissing
        ? new Set(await this.importRepository.getExternalReferencesForDataSource(dataSourceId))
        : new Set<string>();

      const processedReferences = new Set<string>();

      // 8. Procesar registros con AsyncGenerator
      const processStart = Date.now();
      let recordIndex = 0;

      for await (const record of adapter.fetchRecords(config)) {
        // Verificar límite de registros
        if (maxRecords && recordIndex >= maxRecords) {
          console.log(`⏹️ Reached max records limit: ${maxRecords}`);
          break;
        }

        // Saltar registros ya procesados
        if (recordIndex < startFromIndex) {
          recordIndex++;
          continue;
        }

        stats.totalRecords++;

        try {
          // Procesar registro individual
          const action = await this.processRecord(record, dataSource, dryRun, options);
          this.updateStats(stats, action.type);

          // Tracking para detectar eliminados
          if (record.externalId) {
            processedReferences.add(record.externalId);
          }

          // Log de progreso cada 100 registros
          if (stats.totalRecords % 100 === 0) {
            console.log(`📈 Progress: ${stats.totalRecords} records processed`);
          }

          // Guardar checkpoint
          if (recordIndex % checkpointFrequency === 0) {
            await this.checkpointService.save(
              Checkpoint.success(batchId, recordIndex, record.externalId || undefined)
            );
          }
        } catch (error) {
          stats.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);

          errors.push({
            recordIndex,
            externalId: record.externalId ?? undefined,
            action: "CREATE", // Asumimos CREATE en caso de error
            message: errorMessage,
          });

          // Guardar checkpoint de error
          await this.checkpointService.save(
            Checkpoint.failed(batchId, recordIndex, errorMessage, record.externalId || undefined)
          );

          // Log error
          if (!dryRun) {
            await this.importRepository.logImportError({
              batchId,
              rowNumber: recordIndex,
              errorType: "SYSTEM_ERROR",
              errorMessage,
              severity: "ERROR",
              rowData: record.toJSON(),
            });
          }
        }

        recordIndex++;
      }

      processDuration = Date.now() - processStart;

      // 9. Desactivar registros no encontrados (si está habilitado)
      if (deactivateMissing && !dryRun) {
        const missingReferences = [...existingReferences].filter(
          (ref) => !processedReferences.has(ref)
        );

        console.log(`🗑️ Found ${missingReferences.length} missing records to deactivate`);

        for (const externalRef of missingReferences) {
          try {
            const aed = await this.importRepository.findAedByExternalReference(externalRef);
            if (aed) {
              await this.importRepository.deactivateAed(
                aed.id,
                `No longer found in source: ${dataSource.name}`
              );
              stats.deactivated++;
            }
          } catch (error) {
            errors.push({
              recordIndex: -1,
              externalId: externalRef,
              action: "DEACTIVATE",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // 10. Finalizar batch
      await this.importRepository.updateBatchStatus(batchId, "COMPLETED", {
        successfulRecords: stats.created + stats.updated + stats.skipped,
        failedRecords: stats.failed,
        completedAt: new Date(),
      });

      // 11. Actualizar última sincronización en data source
      if (!dryRun) {
        await this.dataSourceRepository.updateLastSync(dataSourceId, new Date());
      }

      console.log(`✅ Sync completed for ${dataSource.name}`);
      console.log(
        `   Created: ${stats.created}, Updated: ${stats.updated}, Skipped: ${stats.skipped}`
      );
      console.log(`   Deactivated: ${stats.deactivated}, Failed: ${stats.failed}`);

      return {
        success: stats.failed === 0,
        batchId,
        dataSourceId,
        dryRun,
        stats,
        errors,
        duration: {
          totalMs: Date.now() - startTime,
          fetchMs: fetchDuration,
          processMs: processDuration,
        },
      };
    } catch (error) {
      // Error fatal - marcar batch como fallido
      await this.importRepository.updateBatchStatus(batchId, "FAILED", {
        failedRecords: stats.failed + 1,
      });

      throw error;
    } finally {
      // Limpiar heartbeat
      this.heartbeatService.stop();
    }
  }

  /**
   * Procesa un registro individual
   * Determina la acción (CREATE/UPDATE/SKIP) y la ejecuta
   */
  private async processRecord(
    record: ImportRecord,
    dataSource: { id: string; matchingStrategy: string; autoUpdateFields: string[] },
    dryRun: boolean,
    options: ProcessingOptions
  ): Promise<ReconciliationAction> {
    // 1. Buscar registro existente por referencia externa
    const existingAed = record.externalId
      ? await this.importRepository.findAedByExternalReference(record.externalId)
      : null;

    // 2. Determinar acción de reconciliación
    let action: ReconciliationAction;

    if (!existingAed) {
      // Nuevo registro - CREATE
      action = ReconciliationAction.create(record);
    } else {
      // Registro existente - verificar cambios
      const currentHash = existingAed.contentHash;
      const newHash = record.contentHash;

      if (currentHash === newHash) {
        // Sin cambios - SKIP
        action = ReconciliationAction.skipNoChanges(record, existingAed.id);
      } else {
        // Cambios detectados - UPDATE
        const fieldsToUpdate = options.updateExistingFields || dataSource.autoUpdateFields || [];
        action = ReconciliationAction.update(record, existingAed.id, fieldsToUpdate);
      }
    }

    // 3. Ejecutar acción (si no es dry run)
    if (!dryRun) {
      await this.executeAction(action, dataSource.id);
    }

    return action;
  }

  /**
   * Ejecuta una acción de reconciliación
   */
  private async executeAction(action: ReconciliationAction, dataSourceId: string): Promise<void> {
    const record = action.record;

    switch (action.type) {
      case "CREATE":
        if (record) {
          // Crear nuevo AED desde el registro de importación
          await this.importRepository.createAedFromImportRecord(record, dataSourceId);
        }
        break;

      case "UPDATE":
        if (action.matchedAedId && action.changedFields.length > 0 && record) {
          // Construir objeto de campos a actualizar
          const fieldsData: Record<string, unknown> = {};
          for (const field of action.changedFields) {
            const value = record.get(field);
            if (value !== null) {
              fieldsData[field] = value;
            }
          }

          // Actualizar campos
          await this.importRepository.updateAedFields(action.matchedAedId, fieldsData);

          // Actualizar hash de contenido
          await this.importRepository.updateAedContentHash(action.matchedAedId, record.contentHash);

          // Actualizar timestamp de última sincronización
          await this.importRepository.updateAedLastSyncedAt(action.matchedAedId, new Date());
        }
        break;

      case "SKIP":
        // Solo actualizar timestamp de última sincronización
        if (action.matchedAedId) {
          await this.importRepository.updateAedLastSyncedAt(action.matchedAedId, new Date());
        }
        break;

      case "DEACTIVATE":
        if (action.matchedAedId) {
          await this.importRepository.deactivateAed(action.matchedAedId, action.reason);
        }
        break;

      case "CONFLICT":
        // Los conflictos se manejan creando un registro que requiere atención
        console.warn(`⚠️ Conflict detected for record: ${record?.externalId}`);
        break;
    }
  }

  /**
   * Actualiza las estadísticas según el tipo de acción
   */
  private updateStats(stats: SyncStats, actionType: ReconciliationActionType): void {
    switch (actionType) {
      case "CREATE":
        stats.created++;
        break;
      case "UPDATE":
        stats.updated++;
        break;
      case "SKIP":
        stats.skipped++;
        break;
      case "DEACTIVATE":
        stats.deactivated++;
        break;
      case "CONFLICT":
        // Los conflictos se cuentan como skipped por ahora
        stats.skipped++;
        break;
    }
  }
}
