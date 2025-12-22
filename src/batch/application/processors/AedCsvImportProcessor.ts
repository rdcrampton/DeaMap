/**
 * AED CSV Import Processor
 *
 * Processor for importing AEDs from CSV files.
 * Replaces the legacy ImportDeaBatchUseCase with the new batch job system.
 */

import {
  BaseBatchJobProcessor,
  ProcessorContext,
  ProcessorInitResult,
  ProcessorValidationResult,
  ProcessChunkResult,
  ProcessRecordResult,
  JobType,
  JobResult,
  AedCsvImportConfig,
} from "@/batch/domain";
import { BatchJob } from "@/batch/domain/entities";
import { PrismaClient } from "@/generated/client/client";
import * as fs from "fs";

interface CsvRecord {
  [key: string]: string;
}

// Minimal outcome for duplicate checks
interface DuplicateCheckOutcome {
  isDuplicate: boolean;
  matchedBy?: "id" | "code" | "externalReference";
  matchedAedId?: string;
  matchedCode?: string | null;
  matchedExternalReference?: string | null;
}

export class AedCsvImportProcessor extends BaseBatchJobProcessor<AedCsvImportConfig> {
  readonly jobType = JobType.AED_CSV_IMPORT;

  private records: CsvRecord[] = [];
  private headers: string[] = [];

  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  validateConfig(config: AedCsvImportConfig): ProcessorValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.filePath) {
      errors.push("filePath is required");
    } else if (!fs.existsSync(config.filePath)) {
      errors.push(`File not found: ${config.filePath}`);
    }

    if (!config.columnMappings || config.columnMappings.length === 0) {
      errors.push("columnMappings is required");
    }

    // Check required field mappings
    const mappedFields = config.columnMappings?.map((m) => m.systemField) || [];
    const requiredFields = ["name"];

    for (const field of requiredFields) {
      if (!mappedFields.includes(field)) {
        warnings.push(`Required field '${field}' is not mapped`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async initialize(config: AedCsvImportConfig): Promise<ProcessorInitResult> {
    try {
      // Read and parse CSV file
      const content = fs.readFileSync(config.filePath, "utf-8");
      const delimiter = config.delimiter || ";";

      const lines = content.split("\n").filter((line) => line.trim());

      if (lines.length === 0) {
        return {
          success: false,
          totalRecords: 0,
          error: "CSV file is empty",
        };
      }

      // Parse headers
      this.headers = this.parseCsvLine(lines[0], delimiter);

      // Parse records
      this.records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCsvLine(lines[i], delimiter);
        const record: CsvRecord = {};

        this.headers.forEach((header, index) => {
          record[header] = values[index] || "";
        });

        this.records.push(record);
      }

      return {
        success: true,
        totalRecords: this.records.length,
        metadata: {
          headers: this.headers,
          fileName: config.filePath.split("/").pop(),
        },
      };
    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        error: error instanceof Error ? error.message : "Failed to parse CSV file",
      };
    }
  }

  async processChunk(context: ProcessorContext): Promise<ProcessChunkResult> {
    const { job, startIndex, chunkSize, onCheckpoint, onHeartbeat } = context;
    const config = job.config as AedCsvImportConfig;
    const results: ProcessRecordResult[] = [];

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    const endIndex = Math.min(startIndex + chunkSize, this.records.length);

    for (let i = startIndex; i < endIndex; i++) {
      // Check timeout
      if (this.isApproachingTimeout(context)) {
        break;
      }

      const record = this.records[i];
      const result = await this.processRecord(record, config, i);
      results.push(result);

      if (result.success) {
        if (result.action === "skipped") {
          skippedCount++;
        } else {
          successCount++;
        }
      } else {
        failedCount++;
      }

      processedCount++;

      // Save checkpoint
      if (processedCount % config.checkpointFrequency === 0) {
        if (onCheckpoint) {
          await onCheckpoint(i);
        }
      }

      // Heartbeat
      if (onHeartbeat && processedCount % 10 === 0) {
        await onHeartbeat();
      }
    }

    // Final checkpoint
    if (onCheckpoint && processedCount > 0) {
      await onCheckpoint(startIndex + processedCount - 1);
    }

    const hasMore = startIndex + processedCount < this.records.length;

    return {
      processedCount,
      successCount,
      failedCount,
      skippedCount,
      results,
      hasMore,
      nextIndex: startIndex + processedCount,
      shouldContinue: failedCount < processedCount * 0.5,
    };
  }

  private async processRecord(
    record: CsvRecord,
    config: AedCsvImportConfig,
    index: number
  ): Promise<ProcessRecordResult> {
    try {
      // Map CSV columns to system fields
      const mappedData = this.mapRecord(record, config.columnMappings);
      const recordRef = mappedData.name || `row-${index + 2}`;

      // Validate required fields
      if (!mappedData.name) {
        return this.createFailedResult(recordRef, "MISSING_DATA", "Name is required", "error");
      }

      // Check for duplicates if enabled
      if (config.skipDuplicates) {
        const duplicate = await this.checkDuplicate(mappedData, config.duplicateThreshold);
        if (duplicate.isDuplicate) {
          return this.createSuccessResult("skipped", undefined, recordRef, {
            reason: "duplicate",
            matchedBy: duplicate.matchedBy,
            matchedAedId: duplicate.matchedAedId,
            matchedCode: duplicate.matchedCode,
            matchedExternalReference: duplicate.matchedExternalReference,
          });
        }
      }

      // Dry run - don't create
      if (config.dryRun) {
        return this.createSuccessResult("skipped", undefined, recordRef, {
          action: "would_create",
          data: mappedData,
        });
      }

      // Create AED
      const aed = await this.createAed(mappedData, config);
      return this.createSuccessResult("created", aed.id, recordRef);
    } catch (error) {
      return this.createFailedResult(
        `row-${index + 2}`,
        "PROCESSING_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "error"
      );
    }
  }

  private mapRecord(
    record: CsvRecord,
    mappings: AedCsvImportConfig["columnMappings"]
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const mapping of mappings) {
      const value = record[mapping.csvColumn];
      if (value !== undefined && value !== "") {
        result[mapping.systemField] = value.trim();
      }
    }

    return result;
  }

  /**
   * Verifica duplicados con cascada de matching:
   * 1. Por ID (si el usuario lo proporciona)
   * 2. Por code
   * 3. Por external_reference
   * 
   * Esto permite re-ejecutar importaciones de forma segura
   */
  private async checkDuplicate(
    data: Record<string, string>,
    _threshold: number
  ): Promise<DuplicateCheckOutcome> {
    const outcome: DuplicateCheckOutcome = { isDuplicate: false };

    const id = data.id?.trim();
    const code = data.code?.trim();
    const externalRef = data.externalReference?.trim();

    // Si no hay ningún identificador, no podemos verificar duplicados
    if (!id && !code && !externalRef) return outcome;

    // ========================================
    // PRIORIDAD 1: Buscar por ID
    // ========================================
    if (id) {
      try {
        const existingById = await this.prisma.aed.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            external_reference: true,
          },
        });

        if (existingById) {
          return {
            isDuplicate: true,
            matchedBy: "id",
            matchedAedId: existingById.id,
            matchedCode: existingById.code,
            matchedExternalReference: existingById.external_reference,
          };
        }
      } catch (error) {
        // ID no válido o no es UUID, continuar con otros métodos
        console.warn(`Invalid ID format: ${id}`, error);
      }
    }

    // ========================================
    // PRIORIDAD 2: Buscar por code
    // ========================================
    if (code) {
      const existingByCode = await this.prisma.aed.findFirst({
        where: {
          code: {
            equals: code,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          code: true,
          external_reference: true,
        },
      });

      if (existingByCode) {
        return {
          isDuplicate: true,
          matchedBy: "code",
          matchedAedId: existingByCode.id,
          matchedCode: existingByCode.code,
          matchedExternalReference: existingByCode.external_reference,
        };
      }
    }

    // ========================================
    // PRIORIDAD 3: Buscar por external_reference
    // ========================================
    if (externalRef) {
      const existingByExtRef = await this.prisma.aed.findFirst({
        where: {
          external_reference: {
            equals: externalRef,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          code: true,
          external_reference: true,
        },
      });

      if (existingByExtRef) {
        return {
          isDuplicate: true,
          matchedBy: "externalReference",
          matchedAedId: existingByExtRef.id,
          matchedCode: existingByExtRef.code,
          matchedExternalReference: existingByExtRef.external_reference,
        };
      }
    }

    // No se encontró ningún duplicado
    return outcome;
  }

  private async createAed(
    data: Record<string, string>,
    _config: AedCsvImportConfig
  ): Promise<{ id: string }> {
    // Parse coordinates
    const latitude = data.latitude ? parseFloat(data.latitude) : undefined;
    const longitude = data.longitude ? parseFloat(data.longitude) : undefined;

    // Create location (coordinates are now only in Aed table)
    const location = await this.prisma.aedLocation.create({
      data: {
        street_name: data.streetName,
        street_number: data.streetNumber,
        postal_code: data.postalCode,
        city_name: data.city,
        city_code: data.cityCode,
        district_name: data.district,
      },
    });

    // Create AED
    const aed = await this.prisma.aed.create({
      data: {
        name: data.name,
        establishment_type: data.establishmentType,
        latitude,
        longitude,
        location_id: location.id,
        source_origin: "CSV_IMPORT",
        status: "DRAFT",
      },
      select: { id: true },
    });

    return aed;
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  async finalize(job: BatchJob): Promise<JobResult> {
    return JobResult.fromProgress(job.progress).complete();
  }

  async cleanup(_job: BatchJob): Promise<void> {
    this.records = [];
    this.headers = [];
  }

  async preview(
    config: AedCsvImportConfig,
    limit: number = 5
  ): Promise<{
    sampleRecords: Record<string, unknown>[];
    totalCount: number;
  }> {
    try {
      const content = fs.readFileSync(config.filePath, "utf-8");
      const delimiter = config.delimiter || ";";
      const lines = content.split("\n").filter((line) => line.trim());

      if (lines.length === 0) {
        return { sampleRecords: [], totalCount: 0 };
      }

      const headers = this.parseCsvLine(lines[0], delimiter);
      const sampleRecords: Record<string, unknown>[] = [];

      for (let i = 1; i <= Math.min(limit, lines.length - 1); i++) {
        const values = this.parseCsvLine(lines[i], delimiter);
        const record: Record<string, string> = {};

        headers.forEach((header, index) => {
          record[header] = values[index] || "";
        });

        // Apply column mappings if provided
        if (config.columnMappings) {
          sampleRecords.push(this.mapRecord(record, config.columnMappings));
        } else {
          sampleRecords.push(record);
        }
      }

      return {
        sampleRecords,
        totalCount: lines.length - 1,
      };
    } catch {
      return { sampleRecords: [], totalCount: 0 };
    }
  }
}
