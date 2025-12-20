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
import { S3DataCacheService } from "@/batch/infrastructure/services/S3DataCacheService";

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
  private s3Cache: S3DataCacheService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly dataSourceRepository: IDataSourceRepository
  ) {
    super();
    this.s3Cache = new S3DataCacheService();
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
      let rawRecords: Record<string, unknown>[];
      let totalRecords: number;

      // CHUNK 1: Initialize and cache data in S3
      if (startIndex === 0) {
        console.log(`🚀 [ExternalSync] Initializing first chunk - downloading and caching data`);

        if (!this.adapter || !this.dataSource) {
          throw new Error("Adapter or data source not initialized");
        }

        // Download complete JSON data
        console.log(`📥 [ExternalSync] Downloading complete dataset...`);

        // Get all records - fetch the complete dataset
        const recordsArray: Record<string, unknown>[] = [];
        const recordsGenerator = this.adapter.fetchRecords(this.dataSource.config);

        for await (const record of recordsGenerator) {
          recordsArray.push(record.toJSON() as Record<string, unknown>);

          if (recordsArray.length % 1000 === 0) {
            console.log(`📦 [ExternalSync] Downloaded ${recordsArray.length} records...`);
          }
        }

        totalRecords = recordsArray.length;
        console.log(`✅ [ExternalSync] Downloaded ${totalRecords} total records`);

        // Upload to S3
        await this.s3Cache.uploadJsonData(job.id, recordsArray, {
          totalRecords,
          dataSourceId: config.dataSourceId,
          jsonPath: this.dataSource.config.jsonPath,
        });

        // Update job with actual total records
        job.setTotalRecords(totalRecords);

        // Get first chunk
        rawRecords = recordsArray.slice(0, chunkSize);
      } else {
        // CHUNK 2+: Read chunk from S3 cache
        console.log(`📥 [ExternalSync] Reading chunk from S3 cache (${startIndex}-${startIndex + chunkSize - 1})`);

        rawRecords = await this.s3Cache.getJsonChunk(job.id, startIndex, chunkSize);

        // Get total from cache metadata
        const cacheMetadata = await this.s3Cache.getCacheMetadata(job.id);
        totalRecords = cacheMetadata?.totalRecords || job.progress.totalRecords;
      }

      console.log(`🔄 [ExternalSync] Processing ${rawRecords.length} records from chunk`);

      // Process records in the chunk
      for (const rawRecord of rawRecords) {
        // Check timeout before processing each record
        if (this.isApproachingTimeout(context)) {
          console.warn(`⏰ [ExternalSync] Approaching timeout, stopping chunk processing`);
          break;
        }

        // Convert to ImportRecord
        const importRecord = ImportRecord.fromApiRecord(
          rawRecord,
          this.dataSource?.config.fieldMappings || {},
          currentIndex,
          this.detectExternalIdField(rawRecord)
        );

        // Process the record
        const result = await this.processRecord(importRecord, config, currentIndex);
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

        // Save checkpoint more frequently (every 5 records)
        if (processedCount % 5 === 0) {
          if (onCheckpoint) {
            const recordHash = this.generateImportRecordHash(importRecord);
            await onCheckpoint(currentIndex - 1, recordHash);
          }
        }

        // Send heartbeat
        if (onHeartbeat && processedCount % 5 === 0) {
          await onHeartbeat();
        }
      }

      // Determine if there are more records
      const hasMore = currentIndex < totalRecords;

      console.log(
        `✅ [ExternalSync] Chunk complete: ${processedCount} processed, hasMore: ${hasMore}, next: ${currentIndex}`
      );

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
      console.error(`❌ [ExternalSync] Error processing chunk:`, error);
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

  /**
   * Generate hash from ImportRecord for checkpoint
   */
  private generateImportRecordHash(record: ImportRecord): string {
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

  /**
   * Detect the external ID field from a raw record
   */
  private detectExternalIdField(record: Record<string, unknown>): string {
    const keys = Object.keys(record);

    // Common ID field names
    const idCandidates = [
      "id",
      "codigo_dea",
      "id_dea",
      "external_id",
      "dea_id",
      "_id",
      "identificador",
    ];

    for (const candidate of idCandidates) {
      if (keys.includes(candidate)) {
        return candidate;
      }
    }

    // Fallback to first key or 'id'
    return keys[0] || "id";
  }

  async finalize(job: BatchJob): Promise<JobResult> {
    // Clean up S3 cache
    console.log(`🧹 [ExternalSync] Cleaning up S3 cache for job ${job.id}`);
    await this.s3Cache.deleteCache(job.id);

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

  async cleanup(job: BatchJob): Promise<void> {
    // Clean up S3 cache on error/cancellation
    console.log(`🧹 [ExternalSync] Cleanup - removing S3 cache for job ${job.id}`);
    await this.s3Cache.deleteCache(job.id);

    // Clear adapter and data source
    this.adapter = null;
    this.dataSource = null;
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
