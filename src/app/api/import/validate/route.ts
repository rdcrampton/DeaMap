/**
 * API Route: Validar datos del CSV
 * POST /api/import/validate
 * Pre-valida los datos usando los mapeos configurados
 *
 * Uses the new batch job system with dryRun mode
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { CreateBatchJobUseCase } from "@/batch/application/use-cases";
import { initializeProcessors } from "@/batch/application/processors";
import { PrismaDataSourceRepository } from "@/import/infrastructure/repositories/PrismaDataSourceRepository";
import { JobType, AedCsvImportConfig } from "@/batch/domain";

const repository = new PrismaBatchJobRepository(prisma);
const dataSourceRepository = new PrismaDataSourceRepository(prisma);

// Initialize processors
initializeProcessors(prisma, dataSourceRepository);

const orchestrator = new BatchJobOrchestrator(repository);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, mappings, maxRowsToValidate = 100 } = body;

    if (!filePath || !mappings) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos (filePath, mappings)" },
        { status: 400 }
      );
    }

    // Convert mappings to the new format
    const columnMappings = mappings.map(
      (m: { csvColumn: string; systemFieldKey?: string; systemField?: string }) => ({
        csvColumn: m.csvColumn,
        systemField: m.systemFieldKey || m.systemField,
      })
    );

    // Create a dry-run job to validate
    const config: AedCsvImportConfig = {
      type: JobType.AED_CSV_IMPORT,
      filePath,
      columnMappings,
      delimiter: ";",
      skipDuplicates: true,
      duplicateThreshold: 75,
      // Base config
      chunkSize: maxRowsToValidate,
      maxRetries: 0,
      retryDelayMs: 0,
      timeoutMs: 30000,
      checkpointFrequency: 100,
      heartbeatIntervalMs: 30000,
      skipOnError: true,
      dryRun: true, // DRY RUN - don't create anything
      validateOnly: true, // Only validate, no writes
      notifyOnComplete: false,
      notifyOnError: false,
    };

    const useCase = new CreateBatchJobUseCase(orchestrator);
    const result = await useCase.execute({
      type: JobType.AED_CSV_IMPORT,
      name: "Validación de CSV",
      description: "Validación previa de datos CSV",
      config,
      createdBy: "system", // Validation is a system operation
      startImmediately: true,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error en la validación" },
        { status: 400 }
      );
    }

    // Get the validation results from the job
    const job = result.job;
    const progress = job?.progress;
    const jobResult = job?.result;

    return NextResponse.json({
      success: true,
      validation: {
        isValid: progress?.failedRecords === 0,
        totalRecords: progress?.totalRecords || 0,
        validRecords: progress?.successfulRecords || 0,
        invalidRecords: progress?.failedRecords || 0,
        skippedRecords: progress?.skippedRecords || 0,
        warningRecords: progress?.warningRecords || 0,
      },
      summary: {
        recordsAnalyzed: progress?.processedRecords || 0,
        wouldCreate: progress?.successfulRecords || 0,
        wouldSkip: progress?.skippedRecords || 0,
        errors: jobResult?.errorCount || 0,
        warnings: jobResult?.warningCount || 0,
      },
      errors: jobResult?.errors?.slice(0, 20) || [],
      warnings: jobResult?.warnings?.slice(0, 20) || [],
      jobId: job?.id,
    });
  } catch (error) {
    console.error("Error in validate API:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
