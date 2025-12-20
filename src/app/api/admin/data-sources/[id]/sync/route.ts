/**
 * Admin API para ejecutar sincronizaciรณn de una fuente de datos
 * Solo accesible para usuarios con rol ADMIN
 *
 * Uses the new BatchJob system for external sync
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { CreateBatchJobUseCase, ContinueBatchJobUseCase } from "@/batch/application/use-cases";
import { initializeProcessors } from "@/batch/application/processors";
import { PrismaDataSourceRepository } from "@/import/infrastructure/repositories/PrismaDataSourceRepository";
import { JobType, ExternalSyncConfig, JobStatus } from "@/batch/domain";

const repository = new PrismaBatchJobRepository(prisma);
const dataSourceRepository = new PrismaDataSourceRepository(prisma);

// Initialize processors
initializeProcessors(prisma, dataSourceRepository);

const orchestrator = new BatchJobOrchestrator(repository);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/data-sources/[id]/sync
 * Ejecuta la sincronizaciรณn de una fuente de datos
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Verificar que la fuente existe y estรก activa
    const dataSource = await prisma.externalDataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      return NextResponse.json({ error: "Fuente de datos no encontrada" }, { status: 404 });
    }

    if (!dataSource.is_active) {
      return NextResponse.json({ error: "La fuente de datos no estรก activa" }, { status: 400 });
    }

    // Check if we should continue an existing job
    const continueJobId = body.continueJobId as string | undefined;
    const batchSize = body.batchSize ? parseInt(body.batchSize) : 30; // Reduced from 100 to 30 to avoid timeouts

    // If continuing a job, use the continue flow
    if (continueJobId) {
      const continueUseCase = new ContinueBatchJobUseCase(orchestrator);
      const continueResult = await continueUseCase.execute({ jobId: continueJobId });

      if (!continueResult.success) {
        return NextResponse.json({ error: continueResult.error }, { status: 400 });
      }

      const job = continueResult.job!;
      const progress = job.progress;

      return NextResponse.json({
        success: true,
        data: {
          jobId: job.id,
          dataSourceId: id,
          dryRun: false,
          stats: {
            total: progress.totalRecords,
            processed: progress.processedRecords,
            created: progress.successfulRecords,
            updated: 0, // Would need to track separately
            skipped: progress.skippedRecords,
            failed: progress.failedRecords,
          },
          progress: {
            total: progress.totalRecords,
            processed: progress.processedRecords,
            percentage: progress.percentage,
            hasMore: progress.hasMore,
            status: job.status,
          },
        },
        message: progress.hasMore
          ? `Procesando: ${progress.processedRecords}/${progress.totalRecords} registros (${progress.percentage}%)`
          : `Sincronizaciรณn completada: ${progress.successfulRecords} exitosos`,
      });
    }

    // Check for existing active job for this data source
    const activeJobs = await repository.findActiveJobs({
      types: [JobType.AED_EXTERNAL_SYNC],
    });

    const existingJob = activeJobs.find((j) => {
      const config = j.config as ExternalSyncConfig;
      return config.dataSourceId === id;
    });

    if (existingJob) {
      // Continue the existing job
      const continueUseCase = new ContinueBatchJobUseCase(orchestrator);
      const continueResult = await continueUseCase.execute({ jobId: existingJob.id });

      if (!continueResult.success) {
        return NextResponse.json({ error: continueResult.error }, { status: 400 });
      }

      const job = continueResult.job!;
      const progress = job.progress;

      return NextResponse.json({
        success: true,
        data: {
          jobId: job.id,
          dataSourceId: id,
          continued: true,
          stats: {
            total: progress.totalRecords,
            processed: progress.processedRecords,
            created: progress.successfulRecords,
            skipped: progress.skippedRecords,
            failed: progress.failedRecords,
          },
          progress: {
            total: progress.totalRecords,
            processed: progress.processedRecords,
            percentage: progress.percentage,
            hasMore: progress.hasMore,
            status: job.status,
          },
        },
        message: `Continuando job existente: ${progress.processedRecords}/${progress.totalRecords}`,
      });
    }

    // Create new sync job
    const config: ExternalSyncConfig = {
      type: JobType.AED_EXTERNAL_SYNC,
      dataSourceId: id,
      forceFullSync: body.forceFullSync === true,
      autoDeactivateMissing: body.deactivateMissing ?? dataSource.auto_deactivate_missing,
      // Base config
      chunkSize: batchSize,
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 85000, // 85 seconds to leave margin for Vercel's 100s limit
      checkpointFrequency: 5, // Save checkpoint every 5 records
      heartbeatIntervalMs: 15000, // More frequent heartbeats
      skipOnError: true,
      dryRun: body.dryRun === true,
      validateOnly: false,
      notifyOnComplete: false,
      notifyOnError: false,
    };

    const createUseCase = new CreateBatchJobUseCase(orchestrator);

    // Wrap execution with timeout handling
    const executionTimeout = 85000; // 85 seconds
    let result: Awaited<ReturnType<typeof createUseCase.execute>>;

    try {
      const executionPromise = createUseCase.execute({
        type: JobType.AED_EXTERNAL_SYNC,
        name: `Sync: ${dataSource.name}`,
        description: `Sincronización automática desde ${dataSource.type}`,
        config,
        createdBy: user.userId,
        dataSourceId: id,
        startImmediately: true,
        metadata: {
          dataSourceName: dataSource.name,
          dataSourceType: dataSource.type,
          regionCode: dataSource.region_code,
        },
        tags: ["sync", dataSource.region_code, dataSource.type.toLowerCase()],
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("EXECUTION_TIMEOUT")), executionTimeout)
      );

      result = (await Promise.race([executionPromise, timeoutPromise])) as Awaited<
        ReturnType<typeof createUseCase.execute>
      >;
    } catch (timeoutError) {
      // If timeout occurs, try to find and mark the job as interrupted
      console.error("Sync execution timeout:", timeoutError);

      // Try to find any recently created job for this data source
      const recentJobs = await repository.findActiveJobs({
        types: [JobType.AED_EXTERNAL_SYNC],
      });

      const recentJob = recentJobs.find((j) => {
        const jobConfig = j.config as ExternalSyncConfig;
        return jobConfig.dataSourceId === id;
      });

      if (recentJob) {
        // Return the job info so client can continue it
        return NextResponse.json({
          success: true,
          data: {
            jobId: recentJob.id,
            dataSourceId: id,
            interrupted: true,
            stats: {
              total: recentJob.progress.totalRecords,
              processed: recentJob.progress.processedRecords,
              created: recentJob.progress.successfulRecords,
              skipped: recentJob.progress.skippedRecords,
              failed: recentJob.progress.failedRecords,
            },
            progress: {
              total: recentJob.progress.totalRecords,
              processed: recentJob.progress.processedRecords,
              percentage: recentJob.progress.percentage,
              hasMore: true,
              status: recentJob.status,
            },
          },
          message: `Sincronización en progreso: ${recentJob.progress.processedRecords}/${recentJob.progress.totalRecords}. Continúa automáticamente.`,
        });
      }

      return NextResponse.json(
        {
          error: "La sincronización está tomando más tiempo del esperado",
          details: "El proceso continúa en segundo plano. Recarga la página para ver el progreso.",
        },
        { status: 202 } // Accepted
      );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const job = result.job!;
    const progress = job.progress;

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        dataSourceId: id,
        dryRun: config.dryRun,
        stats: {
          total: progress.totalRecords,
          processed: progress.processedRecords,
          created: progress.successfulRecords,
          skipped: progress.skippedRecords,
          failed: progress.failedRecords,
        },
        progress: {
          total: progress.totalRecords,
          processed: progress.processedRecords,
          percentage: progress.percentage,
          hasMore: progress.hasMore,
          status: job.status,
        },
      },
      message: progress.hasMore
        ? `Sincronización iniciada: ${progress.processedRecords}/${progress.totalRecords} registros (${progress.percentage}%)`
        : `Sincronización completada: ${progress.successfulRecords} exitosos`,
    });
  } catch (error) {
    console.error("Error during sync:", error);

    // Check if it's a timeout error
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        {
          error: "Timeout durante la sincronización",
          details:
            "El proceso puede continuar en segundo plano. Recarga la página para ver el estado.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: "Error durante la sincronización",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/data-sources/[id]/sync
 * Obtiene el estado de la รบltima sincronizaciรณn
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Find the last job for this data source
    const jobs = await repository.findMany(
      {
        types: [JobType.AED_EXTERNAL_SYNC],
      },
      { page: 1, pageSize: 1 },
      { field: "createdAt", direction: "desc" }
    );

    // Filter by data source ID
    const lastJob = jobs.jobs.find((job) => {
      const config = job.config as ExternalSyncConfig;
      return config.dataSourceId === id;
    });

    if (!lastJob) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No hay sincronizaciones previas",
      });
    }

    // Get errors from database
    const errors = await prisma.batchJobError.findMany({
      where: { job_id: lastJob.id },
      take: 10,
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        jobId: lastJob.id,
        name: lastJob.name,
        status: lastJob.status,
        totalRecords: lastJob.progress.totalRecords,
        successfulRecords: lastJob.progress.successfulRecords,
        failedRecords: lastJob.progress.failedRecords,
        createdAt: lastJob.createdAt,
        completedAt: lastJob.completedAt,
        lastHeartbeat: lastJob.lastHeartbeat,
        canContinue: (
          [JobStatus.WAITING, JobStatus.PAUSED, JobStatus.INTERRUPTED] as JobStatus[]
        ).includes(lastJob.status),
        recentErrors: errors.map((err) => ({
          recordIndex: err.record_index,
          errorType: err.error_type,
          message: err.error_message,
          severity: err.severity,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "Error al obtener el estado de sincronizaciรณn" },
      { status: 500 }
    );
  }
}
