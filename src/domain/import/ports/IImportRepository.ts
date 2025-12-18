/**
 * Puerto: Repositorio de importación
 * Capa de Dominio - Define el contrato para persistencia
 */

import { CsvRow } from "../value-objects/CsvRow";
import { DynamicCsvRow } from "../value-objects/DynamicCsvRow";

export interface CreateImportBatchData {
  name: string;
  description?: string;
  sourceOrigin: string;
  fileName?: string;
  totalRecords: number;
  importedBy: string;
}

export interface ImportBatchInfo {
  id: string;
  name: string;
  status: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  createdAt: Date;
  startedAt?: Date | null;
  completedAt: Date | null;
}

export interface CreateAedFromCsvData {
  csvRow: CsvRow | DynamicCsvRow; // Soporta ambos tipos (legacy y dinámico)
  batchId: string;
  latitude: number | null;
  longitude: number | null;
  addressValidationFailed: boolean;
  imageUrls: Array<{ url: string; type: string }>;
  requiresAttention?: boolean; // Marcar como posible duplicado (score 60-79)
  attentionReason?: string; // Motivo de la atención requerida
}

export interface ImportErrorData {
  batchId: string;
  rowNumber: number;
  errorType: string;
  errorMessage: string;
  severity: string;
  rowData?: Record<string, unknown>;
}

export interface IImportRepository {
  /**
   * Crea un nuevo batch de importación
   */
  createBatch(data: CreateImportBatchData): Promise<string>;

  /**
   * Actualiza el estado de un batch
   */
  updateBatchStatus(
    batchId: string,
    status: string,
    stats?: {
      totalRecords?: number;
      successfulRecords?: number;
      failedRecords?: number;
      completedAt?: Date;
    }
  ): Promise<void>;

  /**
   * Obtiene información de un batch
   */
  getBatchInfo(batchId: string): Promise<ImportBatchInfo | null>;

  /**
   * Crea un AED desde una fila CSV
   */
  createAedFromCsv(data: CreateAedFromCsvData): Promise<string>;

  /**
   * Registra un error de importación
   */
  logImportError(error: ImportErrorData): Promise<void>;

  // ============================================
  // MÉTODOS PARA SYNC CON FUENTES EXTERNAS
  // ============================================

  /**
   * Busca un AED por su referencia externa (codigo_dea, etc.)
   */
  findAedByExternalReference(
    externalRef: string
  ): Promise<{ id: string; contentHash?: string | null } | null>;

  /**
   * Actualiza campos específicos de un AED (para sync parcial)
   */
  updateAedFields(aedId: string, fields: Record<string, unknown>): Promise<void>;

  /**
   * Actualiza el hash de contenido de un AED
   */
  updateAedContentHash(aedId: string, hash: string): Promise<void>;

  /**
   * Marca un AED como inactivo (eliminado de fuente externa)
   */
  deactivateAed(aedId: string, reason: string): Promise<void>;

  /**
   * Obtiene todos los external_reference de una fuente de datos
   * Para detectar cuáles ya no existen en la fuente
   */
  getExternalReferencesForDataSource(dataSourceId: string): Promise<string[]>;

  /**
   * Actualiza la fecha de último sync de un AED
   */
  updateAedLastSyncedAt(aedId: string, syncedAt: Date): Promise<void>;
}
