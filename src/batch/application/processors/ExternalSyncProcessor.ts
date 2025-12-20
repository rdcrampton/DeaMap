/**
 * External Sync Processor
 *
 * Processor for synchronizing AEDs from external data sources.
 * Implements the IBatchJobProcessor interface for the batch job system.
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
  ExternalSyncConfig,
} from "@/batch/domain";
import { BatchJob } from "@/batch/domain/entities";
import { IDataSourceAdapter, DataSourceConfig } from "@/import/domain/ports/IDataSourceAdapter";
import { IDataSourceRepository } from "@/import/domain/ports/IDataSourceRepository";
import { ImportRecord } from "@/import/domain/value-objects/ImportRecord";
import { DataSourceAdapterFactory } from "@/import/infrastructure/adapters/DataSourceAdapterFactory";
import { PrismaClient } from "@/generated/client/client";

interface ExternalDataSourceLocalConfig {
  type: string;
  config: DataSourceConfig;
  matchingStrategy: string;
  matchingThreshold: number;
  autoDeactivateMissing: boolean;
  autoUpdateFields: string[];
  sourceOrigin: string;
  regionCode: string;
}

export class ExternalSyncProcessor extends BaseBatchJobProcessor<ExternalSyncConfig> {
  readonly jobType = JobType.AED_EXTERNAL_SYNC;

  private adapter: IDataSourceAdapter | null = null;
  private dataSource: ExternalDataSourceLocalConfig | null = null;
  private recordsIterator: AsyncGenerator<ImportRecord> | null = null;
  private recordsSkipped: number = 0;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly dataSourceRepository: IDataSourceRepository
  ) {
    super();
  }

  validateConfig(config: ExternalSyncConfig): ProcessorValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.dataSourceId) {
      errors.push("dataSourceId is required");
    }

    if (config.chunkSize && (config.chunkSize < 1 || config.chunkSize > 500)) {
      errors.push("chunkSize must be between 1 and 500");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async initialize(config: ExternalSyncConfig): Promise<ProcessorInitResult> {
    try {
      // Load data source configuration
      const dataSource = await this.dataSourceRepository.findById(config.dataSourceId);

      if (!dataSource) {
        return {
          success: false,
          totalRecords: 0,
          error: `Data source not found: ${config.dataSourceId}`,
        };
      }

      if (!dataSource.isActive) {
        return {
          success: false,
          totalRecords: 0,
          error: "Data source is not active",
        };
      }

      this.dataSource = {
        type: dataSource.type,
        config: dataSource.config,
        matchingStrategy: dataSource.matchingStrategy,
        matchingThreshold: dataSource.matchingThreshold,
        autoDeactivateMissing: dataSource.autoDeactivateMissing,
        autoUpdateFields: dataSource.autoUpdateFields,
        sourceOrigin: dataSource.sourceOrigin,
        regionCode: dataSource.regionCode,
      };

      // Create adapter
      this.adapter = DataSourceAdapterFactory.getApiAdapter(
        dataSource.type as "CKAN_API" | "JSON_FILE" | "REST_API" | "CSV_FILE"
      );

      // Use estimated count instead of actual count to avoid timeout
      // The count will be updated as we process records
      let totalRecords = 99999; // High estimate for large datasets

      try {
        // Try to get actual count with a short timeout
        const countPromise = this.adapter.getRecordCount(this.dataSource.config);
        const timeoutPromise = new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error("Count timeout")), 5000)
        );

        totalRecords = await Promise.race([countPromise, timeoutPromise]);
      } catch (error) {
        // If count fails or times out, use the estimate
        console.warn("Could not get exact record count, using estimate:", error);
      }

      return {
        success: true,
        totalRecords,
        metadata: {
          dataSourceType: this.dataSource.type,
          matchingStrategy: this.dataSource.matchingStrategy,
          regionCode: this.dataSource.regionCode,
          estimatedCount: totalRecords === 99999,
        },
      };
    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        error: error instanceof Error ? error.message : "Unknown initialization error",
      };
    }
  }

  async processChunk(context: ProcessorContext): Promise<ProcessChunkResult> {
    const {
      job,
      startIndex,
      chunkSize,
      timeoutAt: _timeoutAt,
      onCheckpoint,
      onHeartbeat,
    } = context;
    const config = job.config as ExternalSyncConfig;
    const results: ProcessRecordResult[] = [];

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let currentIndex = startIndex;

    try {
      // Initialize records iterator if not already done
      if (!this.recordsIterator && this.adapter && this.dataSource) {
        this.recordsIterator = this.adapter.fetchRecords(this.dataSource.config);
        this.recordsSkipped = 0;
      }

      if (!this.recordsIterator) {
        return {
          processedCount: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          results: [],
          hasMore: false,
          nextIndex: startIndex,
          shouldContinue: false,
          error: "Failed to initialize records iterator",
        };
      }

      // Skip already processed records (without storing them in memory)
      while (this.recordsSkipped < startIndex) {
        // Check timeout during skip phase
        if (this.isApproachingTimeout(context)) {
          return {
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            skippedCount: 0,
            results: [],
            hasMore: true,
            nextIndex: startIndex,
            shouldContinue: true,
            error: "Timeout while skipping to start index",
          };
        }

        const { done } = await this.recordsIterator.next();
        if (done) {
          // Reached end before getting to startIndex
          return {
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            skippedCount: 0,
            results: [],
            hasMore: false,
            nextIndex: startIndex,
            shouldContinue: false,
          };
        }
        this.recordsSkipped++;
      }

      // Process chunk
      while (processedCount < chunkSize) {
        // Check timeout before processing each record
        if (this.isApproachingTimeout(context)) {
          break;
        }

        // Get next record from iterator
        const { value: record, done } = await this.recordsIterator.next();
        if (done) {
          // No more records
          break;
        }

        // Process the record
        const result = await this.processRecord(record, config, currentIndex);
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
        currentIndex++;

        // Save checkpoint more frequently (every 5 records instead of 10)
        if (processedCount % 5 === 0) {
          if (onCheckpoint) {
            const recordHash = this.generateRecordHash(record);
            await onCheckpoint(currentIndex - 1, recordHash);
          }
        }

        // Send heartbeat
        if (onHeartbeat && processedCount % 5 === 0) {
          await onHeartbeat();
        }
      }

      // Determine if there are more records based on chunk completion
      // If we processed exactly chunkSize records, there are likely more
      // If we processed less, the iterator reached the end (done = true)
      const hasMore = processedCount === chunkSize;

      // Final checkpoint
      if (onCheckpoint && processedCount > 0) {
        await onCheckpoint(currentIndex - 1);
      }

      return {
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        results,
        hasMore,
        nextIndex: currentIndex,
        shouldContinue: failedCount < processedCount * 0.5, // Stop if >50% failing
      };
    } catch (error) {
      return {
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        results,
        hasMore: false,
        nextIndex: currentIndex,
        shouldContinue: false,
        error: error instanceof Error ? error.message : "Unknown error during chunk processing",
      };
    }
  }

  private async processRecord(
    record: ImportRecord,
    config: ExternalSyncConfig,
    index: number
  ): Promise<ProcessRecordResult> {
    try {
      const externalId = record.externalId;
      const recordRef = externalId || `record-${index}`;

      // Check if AED already exists
      const existingAed = await this.findExistingAed(record);

      if (existingAed) {
        // Update existing AED
        if (config.dryRun) {
          return this.createSuccessResult("skipped", existingAed.id, recordRef, {
            action: "would_update",
          });
        }

        await this.updateAed(existingAed.id, record);
        return this.createSuccessResult("updated", existingAed.id, recordRef);
      } else {
        // Create new AED
        if (config.dryRun) {
          return this.createSuccessResult("skipped", undefined, recordRef, {
            action: "would_create",
          });
        }

        const newAed = await this.createAed(record, config);
        return this.createSuccessResult("created", newAed.id, recordRef);
      }
    } catch (error) {
      return this.createFailedResult(
        `record-${index}`,
        "PROCESSING_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "error"
      );
    }
  }

  private async findExistingAed(record: ImportRecord): Promise<{ id: string } | null> {
    // Try to find by external reference first
    if (record.externalId) {
      const byExternal = await this.prisma.aed.findFirst({
        where: { external_reference: record.externalId },
        select: { id: true },
      });
      if (byExternal) return byExternal;
    }

    // Try by coordinates if available
    if (record.latitude && record.longitude) {
      const byCoords = await this.prisma.aed.findFirst({
        where: {
          latitude: {
            gte: record.latitude - 0.0001,
            lte: record.latitude + 0.0001,
          },
          longitude: {
            gte: record.longitude - 0.0001,
            lte: record.longitude + 0.0001,
          },
        },
        select: { id: true },
      });
      if (byCoords) return byCoords;
    }

    return null;
  }

  private async createAed(
    record: ImportRecord,
    config: ExternalSyncConfig
  ): Promise<{ id: string }> {
    // Create location first
    const location = await this.prisma.aedLocation.create({
      data: {
        street_name: record.streetName,
        street_number: record.streetNumber,
        postal_code: record.postalCode,
        city_name: record.city,
        city_code: record.cityCode,
        district_name: record.district,
        latitude: record.latitude,
        longitude: record.longitude,
      },
    });

    // Create AED
    const aed = await this.prisma.aed.create({
      data: {
        name: record.name || "Sin nombre",
        establishment_type: record.establishmentType,
        latitude: record.latitude,
        longitude: record.longitude,
        location_id: location.id,
        external_reference: record.externalId,
        source_origin: "EXTERNAL_API",
        data_source_id: config.dataSourceId,
        status: "DRAFT",
        last_synced_at: new Date(),
      },
      select: { id: true },
    });

    return aed;
  }

  private async updateAed(aedId: string, record: ImportRecord): Promise<void> {
    // Update location
    const aed = await this.prisma.aed.findUnique({
      where: { id: aedId },
      select: { location_id: true },
    });

    if (aed?.location_id) {
      await this.prisma.aedLocation.update({
        where: { id: aed.location_id },
        data: {
          street_name: record.streetName,
          street_number: record.streetNumber,
          postal_code: record.postalCode,
          city_name: record.city,
          city_code: record.cityCode,
          district_name: record.district,
          latitude: record.latitude,
          longitude: record.longitude,
        },
      });
    }

    // Update AED
    await this.prisma.aed.update({
      where: { id: aedId },
      data: {
        name: record.name || undefined,
        establishment_type: record.establishmentType || undefined,
        latitude: record.latitude,
        longitude: record.longitude,
        last_synced_at: new Date(),
      },
    });
  }

  private generateRecordHash(record: ImportRecord): string {
    const data = JSON.stringify({
      name: record.name,
      lat: record.latitude,
      lng: record.longitude,
      externalId: record.externalId,
    });
    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  async finalize(job: BatchJob): Promise<JobResult> {
    // Update data source last sync time
    const config = job.config as ExternalSyncConfig;

    await this.prisma.externalDataSource.update({
      where: { id: config.dataSourceId },
      data: {
        last_sync_at: new Date(),
      },
    });

    return JobResult.fromProgress(job.progress)
      .withMetadata("dataSourceId", config.dataSourceId)
      .complete();
  }

  async cleanup(_job: BatchJob): Promise<void> {
    this.adapter = null;
    this.dataSource = null;
    this.recordsIterator = null;
    this.recordsSkipped = 0;
  }

  async preview(
    config: ExternalSyncConfig,
    limit: number = 5
  ): Promise<{
    sampleRecords: Record<string, unknown>[];
    totalCount: number;
  }> {
    const dataSource = await this.dataSourceRepository.findById(config.dataSourceId);

    if (!dataSource) {
      return { sampleRecords: [], totalCount: 0 };
    }

    const adapter = DataSourceAdapterFactory.getApiAdapter(
      dataSource.type as "CKAN_API" | "JSON_FILE" | "REST_API" | "CSV_FILE"
    );

    const records = await adapter.getPreview(dataSource.config, limit);

    const totalCount = await adapter.getRecordCount(dataSource.config);

    return {
      sampleRecords: records.map((r) => r.toJSON()),
      totalCount,
    };
  }
}
