/**
 * BulkImport Service â€” Application Service
 *
 * Orquesta la integraciÃ³n de @batchactions/import con los adaptadores del sistema.
 * Punto de entrada principal para las API routes de importaciÃ³n.
 *
 * Responsabilidades:
 * - Configurar BulkImport con schema, hooks, duplicate checker, state store
 * - Ejecutar preview (validaciÃ³n sin procesamiento)
 * - Ejecutar processChunk (procesamiento serverless)
 * - Restaurar jobs para resume/CRON
 * - Combinar validaciÃ³n de @batchactions/import con auto-mapeo inteligente
 */

import { BulkImport, CsvParser, BufferSource } from "@batchactions/import";
import type { ChunkResult, JobProgress, ProcessedRecord } from "@batchactions/import";
import type { PrismaClient } from "@/generated/client/client";
import type { SharePointAuthConfig } from "@/storage/domain/ports/IImageDownloader";
import type { DownloadAndUploadImageUseCase } from "@/storage/application/use-cases/DownloadAndUploadImageUseCase";
import type { IAedRepository } from "../../domain/ports/IAedRepository";

import { aedImportSchema } from "../../domain/schemas/aedImportSchema";
import { PrismaStateStore } from "../../infrastructure/state/PrismaStateStore";
import { S3DataSource } from "../../infrastructure/sources/S3DataSource";
import { AedDuplicateChecker } from "../../infrastructure/checkers/AedDuplicateChecker";
import { createAedImportHooks } from "../../infrastructure/hooks/aedImportHooks";
import { createAedRecordProcessor } from "../../infrastructure/processors/aedRecordProcessor";

// ============================================================
// Tipos
// ============================================================

export interface ImportPreviewOptions {
  /** Contenido del CSV (string o Buffer) */
  csvContent: string | Buffer;
  /** Delimitador CSV (default: ";") */
  delimiter?: string;
  /** NÃºmero mÃ¡ximo de registros para preview */
  maxRecords?: number;
}

export interface ImportPreviewResult {
  /** Headers detectados en el CSV */
  headers: string[];
  /** Registros de muestra parseados */
  sampleRecords: Array<Record<string, unknown>>;
  /** Total de registros en el CSV */
  totalRecords: number;
  /** Registros vÃ¡lidos en el preview */
  validRecords: number;
  /** Registros invÃ¡lidos con errores */
  invalidRecords: number;
  /** Errores de validaciÃ³n detallados */
  errors: Array<{
    recordIndex: number;
    field: string;
    message: string;
    code: string;
    severity: "error" | "warning";
    suggestion?: string;
  }>;
  /** Warnings (no bloquean) */
  warnings: Array<{
    recordIndex: number;
    field: string;
    message: string;
    suggestion?: string;
  }>;
}

export interface StartImportOptions {
  /** URL del CSV en S3 */
  s3Url: string;
  /** Nombre del archivo original */
  fileName: string;
  /** ID del usuario que inicia la importaciÃ³n */
  userId: string;
  /** Delimitador CSV (default: ";") */
  delimiter?: string;
  /** TamaÃ±o del batch (default: 50) */
  batchSize?: number;
  /** Si true, continÃºa aunque fallen registros (default: true) */
  continueOnError?: boolean;
  /** Si true, los duplicados se reportan como warning (default: true) */
  skipDuplicates?: boolean;
  /** AutenticaciÃ³n SharePoint (cookies) */
  sharePointAuth?: SharePointAuthConfig;
  /** Tiempo mÃ¡ximo por chunk en ms (default: 80000 para Vercel) */
  maxDurationMs?: number;
  /** Nombre del job para la UI */
  jobName?: string;
}

export interface StartImportResult {
  /** ID del job creado */
  jobId: string;
  /** Resultado del primer chunk */
  chunk: ChunkResult;
  /** Progreso actual */
  progress: JobProgress;
}

export interface ResumeImportOptions {
  /** ID del job a continuar */
  jobId: string;
  /** URL del CSV en S3 (necesaria para re-parsear) */
  s3Url: string;
  /** ID del usuario */
  userId: string;
  /** Nombre del archivo */
  fileName?: string;
  /** Delimitador CSV */
  delimiter?: string;
  /** AutenticaciÃ³n SharePoint */
  sharePointAuth?: SharePointAuthConfig;
  /** Tiempo mÃ¡ximo por chunk en ms */
  maxDurationMs?: number;
  /** Si true, los duplicados se reportan como warning */
  skipDuplicates?: boolean;
}

export interface ResumeImportResult {
  /** ID del job */
  jobId: string;
  /** Resultado del chunk procesado */
  chunk: ChunkResult;
  /** Progreso actual */
  progress: JobProgress;
}

// ============================================================
// Service
// ============================================================

export class BulkImportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly aedRepository: IAedRepository,
    private readonly downloadAndUploadImageUseCase?: DownloadAndUploadImageUseCase,
  ) {}

  /**
   * Preview: parsea y valida un CSV sin procesarlo.
   * Ãštil para mostrar preview de datos y errores antes de importar.
   */
  async preview(options: ImportPreviewOptions): Promise<ImportPreviewResult> {
    const {
      csvContent,
      delimiter = ";",
      maxRecords = 100,
    } = options;

    const content = typeof csvContent === "string"
      ? csvContent
      : csvContent.toString("utf-8");

    const importer = new BulkImport({
      schema: aedImportSchema,
      continueOnError: true,
    });

    importer.from(
      new BufferSource(content),
      new CsvParser({ delimiter })
    );

    const preview = await importer.preview(maxRecords);

    // Extraer headers de las columnas detectadas
    const headers = [...preview.columns];

    // Combinar valid + invalid records para anÃ¡lisis
    const allRecords = [...preview.validRecords, ...preview.invalidRecords];

    // Separar errores y warnings
    const errors: ImportPreviewResult["errors"] = [];
    const warnings: ImportPreviewResult["warnings"] = [];

    for (const record of allRecords) {
      for (const error of record.errors) {
        if ((error.severity || "error") === "error") {
          errors.push({
            recordIndex: record.index,
            field: error.field,
            message: error.message,
            code: error.code,
            severity: "error",
            suggestion: error.suggestion,
          });
        } else {
          warnings.push({
            recordIndex: record.index,
            field: error.field,
            message: error.message,
            suggestion: error.suggestion,
          });
        }
      }
    }

    return {
      headers,
      sampleRecords: preview.validRecords.map((r: ProcessedRecord) => r.parsed),
      totalRecords: preview.totalSampled,
      validRecords: preview.validRecords.length,
      invalidRecords: preview.invalidRecords.length,
      errors,
      warnings,
    };
  }

  /**
   * Inicia una importaciÃ³n: crea el job y procesa el primer chunk.
   * Para Vercel: respeta maxDurationMs para no exceder el timeout.
   */
  async startImport(options: StartImportOptions): Promise<StartImportResult> {
    const {
      s3Url,
      fileName,
      userId,
      delimiter = ";",
      batchSize = 50,
      continueOnError = true,
      skipDuplicates = true,
      sharePointAuth,
      maxDurationMs = 80_000,
      jobName,
    } = options;

    // Configurar adaptadores con importContext para que el CRON pueda resumir
    const stateStore = new PrismaStateStore(this.prisma, {
      createdBy: userId,
      jobName: jobName || `Import ${fileName}`,
      importContext: {
        s3Url,
        fileName,
        delimiter,
        sharePointAuth,
        skipDuplicates,
      },
    });

    const duplicateChecker = new AedDuplicateChecker(this.aedRepository, {
      skipDuplicates,
    });

    const hooks = createAedImportHooks({
      prisma: this.prisma,
      downloadAndUploadImageUseCase: this.downloadAndUploadImageUseCase,
      sharePointAuth,
      skipDuplicates,
    });

    // Crear instancia de BulkImport
    const importer = new BulkImport({
      schema: aedImportSchema,
      batchSize,
      continueOnError,
      stateStore,
      duplicateChecker,
      hooks,
    });

    // Configurar source y parser
    const source = new S3DataSource(s3Url, fileName);
    importer.from(source, new CsvParser({ delimiter }));

    // Crear processor
    const processor = createAedRecordProcessor({
      prisma: this.prisma,
      fileName,
    });

    // Procesar primer chunk
    const chunk = await importer.processChunk(processor, {
      maxDurationMs,
    });

    // Obtener progreso
    const jobId = importer.getJobId();
    const progress = await stateStore.getProgress(jobId);

    return {
      jobId,
      chunk,
      progress,
    };
  }

  /**
   * Restaura y continÃºa un job existente.
   * Usado por resume endpoint y CRON.
   */
  async resumeImport(options: ResumeImportOptions): Promise<ResumeImportResult> {
    const {
      jobId,
      s3Url,
      userId,
      fileName,
      delimiter = ";",
      sharePointAuth,
      maxDurationMs = 80_000,
      skipDuplicates = true,
    } = options;

    // Configurar adaptadores con importContext para mantener metadata coherente
    const stateStore = new PrismaStateStore(this.prisma, {
      createdBy: userId,
      importContext: {
        s3Url,
        fileName: fileName || "",
        delimiter,
        sharePointAuth,
        skipDuplicates,
      },
    });

    const duplicateChecker = new AedDuplicateChecker(this.aedRepository, {
      skipDuplicates,
    });

    const hooks = createAedImportHooks({
      prisma: this.prisma,
      downloadAndUploadImageUseCase: this.downloadAndUploadImageUseCase,
      sharePointAuth,
      skipDuplicates,
    });

    // Restaurar instancia desde el state store
    const importer = await BulkImport.restore(jobId, {
      schema: aedImportSchema,
      stateStore,
      duplicateChecker,
      hooks,
    });

    if (!importer) {
      throw new Error(`Job ${jobId} not found or cannot be restored`);
    }

    // Configurar source y parser (necesarios para re-parsear)
    const source = new S3DataSource(s3Url, fileName);
    importer.from(source, new CsvParser({ delimiter }));

    // Crear processor
    const processor = createAedRecordProcessor({
      prisma: this.prisma,
      fileName,
    });

    // Procesar siguiente chunk
    const chunk = await importer.processChunk(processor, {
      maxDurationMs,
    });

    // Obtener progreso
    const progress = await stateStore.getProgress(jobId);

    return {
      jobId,
      chunk,
      progress,
    };
  }

  /**
   * Obtiene el progreso de un job existente.
   */
  async getProgress(jobId: string, userId: string): Promise<JobProgress> {
    const stateStore = new PrismaStateStore(this.prisma, {
      createdBy: userId,
    });
    return stateStore.getProgress(jobId);
  }

  /**
   * Obtiene los registros fallidos de un job.
   */
  async getFailedRecords(jobId: string, userId: string) {
    const stateStore = new PrismaStateStore(this.prisma, {
      createdBy: userId,
    });
    return stateStore.getFailedRecords(jobId);
  }
}

