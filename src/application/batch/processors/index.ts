/**
 * Batch Job Processors
 *
 * Export all processors and provide initialization function.
 */

export * from './ExternalSyncProcessor';
export * from './AedCsvImportProcessor';
export * from './AedExportProcessor';

import { PrismaClient } from '@/generated/client';
import { getProcessorRegistry, JobType } from '@/domain/batch';
import { IDataSourceRepository } from '@/domain/import/ports/IDataSourceRepository';
import { ExternalSyncProcessor } from './ExternalSyncProcessor';
import { AedCsvImportProcessor } from './AedCsvImportProcessor';
import { AedExportProcessor } from './AedExportProcessor';

/**
 * Initialize and register all processors
 */
export function initializeProcessors(
  prisma: PrismaClient,
  dataSourceRepository: IDataSourceRepository
): void {
  const registry = getProcessorRegistry();

  // Register processors
  registry.register(
    JobType.AED_EXTERNAL_SYNC,
    new ExternalSyncProcessor(prisma, dataSourceRepository)
  );

  registry.register(
    JobType.AED_CSV_IMPORT,
    new AedCsvImportProcessor(prisma)
  );

  registry.register(
    JobType.AED_CSV_EXPORT,
    new AedExportProcessor(prisma)
  );

  registry.register(
    JobType.AED_JSON_EXPORT,
    new AedExportProcessor(prisma) // Same processor, different config
  );

  console.log('✅ Batch processors initialized:', registry.getRegisteredTypes());
}
