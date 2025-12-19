/**
 * AED Export Processor
 *
 * Processor for exporting AEDs to CSV or JSON files.
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
  AedExportConfig,
} from "@/batch/domain";
import { BatchJob } from "@/batch/domain/entities";
import { PrismaClient, AedStatus } from "@/generated/client/client";
import * as fs from "fs";
import * as path from "path";

interface AedRecord {
  id: string;
  name: string;
  code: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  establishmentType: string | null;
  location: {
    streetName: string | null;
    streetNumber: string | null;
    postalCode: string | null;
    cityName: string | null;
    cityCode: string | null;
    districtName: string | null;
  } | null;
  createdAt: Date;
}

export class AedExportProcessor extends BaseBatchJobProcessor<AedExportConfig> {
  readonly jobType = JobType.AED_CSV_EXPORT;

  private aedIds: string[] = [];
  private exportedRecords: AedRecord[] = [];
  private outputPath: string = "";

  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  validateConfig(config: AedExportConfig): ProcessorValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.fields || config.fields.length === 0) {
      warnings.push("No fields specified, will export all available fields");
    }

    if (!config.format) {
      errors.push("Export format is required (csv or json)");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async initialize(config: AedExportConfig): Promise<ProcessorInitResult> {
    try {
      // Build query filters
      const where = this.buildWhereClause(config.filters);

      // Get IDs of all AEDs to export
      const aeds = await this.prisma.aed.findMany({
        where,
        select: { id: true },
        orderBy: { created_at: "desc" },
      });

      this.aedIds = aeds.map((a) => a.id);

      // Set output path
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const extension = config.format === "json" ? "json" : "csv";
      this.outputPath = config.outputPath || `/tmp/exports/aeds-${timestamp}.${extension}`;

      // Ensure directory exists
      const dir = path.dirname(this.outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      return {
        success: true,
        totalRecords: this.aedIds.length,
        metadata: {
          format: config.format,
          outputPath: this.outputPath,
          filters: config.filters,
        },
      };
    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        error: error instanceof Error ? error.message : "Failed to initialize export",
      };
    }
  }

  async processChunk(context: ProcessorContext): Promise<ProcessChunkResult> {
    const { job, startIndex, chunkSize, onCheckpoint, onHeartbeat } = context;
    const _config = job.config as AedExportConfig;
    const results: ProcessRecordResult[] = [];

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    const endIndex = Math.min(startIndex + chunkSize, this.aedIds.length);
    const chunkIds = this.aedIds.slice(startIndex, endIndex);

    // Fetch AEDs in batch
    const aeds = await this.prisma.aed.findMany({
      where: { id: { in: chunkIds } },
      include: {
        location: true,
      },
    });

    for (const aed of aeds) {
      try {
        const record: AedRecord = {
          id: aed.id,
          name: aed.name,
          code: aed.code,
          status: aed.status,
          latitude: aed.latitude,
          longitude: aed.longitude,
          establishmentType: aed.establishment_type,
          location: aed.location
            ? {
                streetName: aed.location.street_name,
                streetNumber: aed.location.street_number,
                postalCode: aed.location.postal_code,
                cityName: aed.location.city_name,
                cityCode: aed.location.city_code,
                districtName: aed.location.district_name,
              }
            : null,
          createdAt: aed.created_at,
        };

        this.exportedRecords.push(record);
        successCount++;
        results.push(this.createSuccessResult("created", aed.id, aed.name));
      } catch (error) {
        failedCount++;
        results.push(
          this.createFailedResult(
            aed.id,
            "EXPORT_ERROR",
            error instanceof Error ? error.message : "Unknown error",
            "error"
          )
        );
      }

      processedCount++;

      // Heartbeat
      if (onHeartbeat && processedCount % 50 === 0) {
        await onHeartbeat();
      }
    }

    // Save checkpoint
    if (onCheckpoint && processedCount > 0) {
      await onCheckpoint(startIndex + processedCount - 1);
    }

    const hasMore = startIndex + processedCount < this.aedIds.length;

    return {
      processedCount,
      successCount,
      failedCount,
      skippedCount: 0,
      results,
      hasMore,
      nextIndex: startIndex + processedCount,
      shouldContinue: true,
    };
  }

  async finalize(job: BatchJob): Promise<JobResult> {
    const config = job.config as AedExportConfig;

    try {
      // Write output file
      if (config.format === "json") {
        await this.writeJsonFile();
      } else {
        await this.writeCsvFile(config.fields);
      }

      // Get file stats
      const stats = fs.statSync(this.outputPath);

      return JobResult.fromProgress(job.progress)
        .addArtifact({
          type: "file",
          name: path.basename(this.outputPath),
          mimeType: config.format === "json" ? "application/json" : "text/csv",
          size: stats.size,
          url: this.outputPath,
        })
        .complete();
    } catch (error) {
      return JobResult.fromProgress(job.progress)
        .addError({
          index: -1,
          errorType: "FILE_WRITE_ERROR",
          errorMessage: error instanceof Error ? error.message : "Failed to write export file",
          severity: "critical",
        })
        .complete();
    }
  }

  private async writeJsonFile(): Promise<void> {
    const content = JSON.stringify(this.exportedRecords, null, 2);
    fs.writeFileSync(this.outputPath, content, "utf-8");
  }

  private async writeCsvFile(fields?: string[]): Promise<void> {
    const allFields =
      fields && fields.length > 0
        ? fields
        : [
            "id",
            "name",
            "code",
            "status",
            "latitude",
            "longitude",
            "establishmentType",
            "streetName",
            "streetNumber",
            "postalCode",
            "cityName",
            "cityCode",
            "districtName",
            "createdAt",
          ];

    // Write header
    const header = allFields.join(";");
    let content = header + "\n";

    // Write records
    for (const record of this.exportedRecords) {
      const values = allFields.map((field) => {
        let value: unknown;

        if (
          field.startsWith("location.") ||
          [
            "streetName",
            "streetNumber",
            "postalCode",
            "cityName",
            "cityCode",
            "districtName",
          ].includes(field)
        ) {
          const locationField = field.replace("location.", "");
          value = record.location?.[locationField as keyof typeof record.location];
        } else {
          value = record[field as keyof AedRecord];
        }

        if (value === null || value === undefined) {
          return "";
        }

        if (value instanceof Date) {
          return value.toISOString();
        }

        const strValue = String(value);
        // Escape quotes and wrap in quotes if contains delimiter
        if (strValue.includes(";") || strValue.includes('"') || strValue.includes("\n")) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      });

      content += values.join(";") + "\n";
    }

    fs.writeFileSync(this.outputPath, content, "utf-8");
  }

  async cleanup(_job: BatchJob): Promise<void> {
    this.aedIds = [];
    this.exportedRecords = [];
  }

  private buildWhereClause(filters?: AedExportConfig["filters"]) {
    if (!filters) return {};

    return {
      ...(filters.status && { status: { in: filters.status as AedStatus[] } }),
      ...(filters.organizationId && {
        assignments: {
          some: { organization_id: filters.organizationId },
        },
      }),
      ...(filters.regionCode && {
        location: { city_code: { startsWith: filters.regionCode } },
      }),
      ...(filters.cityCode && {
        location: { city_code: filters.cityCode },
      }),
      ...(filters.dateFrom && {
        created_at: { gte: filters.dateFrom },
      }),
      ...(filters.dateTo && {
        created_at: { lte: filters.dateTo },
      }),
    };
  }
}
