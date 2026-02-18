/**
 * Cron Job: Process Waiting Batch Jobs â€” Dual-mode
 *
 * This endpoint is called by Vercel Cron (every minute) to automatically
 * continue processing batch jobs that are in WAITING status.
 *
 * Soporta dos motores:
 * - engine=bulkimport â†’ @batchactions/import via BulkImportService
 * - legacy (sin engine) â†’ BatchJobOrchestrator (procesador existente)
 *
 * Flow:
 * 1. Find jobs in WAITING, INTERRUPTED, PENDING status
 * 2. For each job, detect engine from metadata
 * 3. Process with appropriate engine
 * 4. Job returns to WAITING if hasMore, or completes
 * 5. Cron will pick it up again in the next minute
 *
 * Security: Protected by Vercel Cron Secret
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { initializeProcessors } from "@/batch/application/processors";
import { PrismaDataSourceRepository } from "@/import/infrastructure/repositories/PrismaDataSourceRepository";
import { getBulkImportService } from "@/import/infrastructure/factories/createBulkImportService";
import type { ImportContext } from "@/import/infrastructure/state/PrismaStateStore";

const repository = new PrismaBatchJobRepository(prisma);
const dataSourceRepository = new PrismaDataSourceRepository(prisma);

// Initialize processors (legacy engine)
initializeProcessors(prisma, dataSourceRepository);

const orchestrator = new BatchJobOrchestrator(repository);

// Timeout mÃ¡s corto para CRON (50s timeout en Vercel, dejamos 5s buffer)
const CRON_MAX_DURATION_MS = 45_000;

/**
 * Process waiting jobs (main logic)
 * Used by both GET (Vercel Cron) and POST (manual trigger)
 */
async function processWaitingJobs(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Verify Vercel Cron Secret (optional)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("ðŸš« [Cron] Unauthorized cron request");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    console.log("â° [Cron] Starting batch job processing...");

    // 1. RECOVER ORPHANED JOBS (IN_PROGRESS without heartbeat for >3 minutes)
    const orphanedJobs = await repository.findTimedOutJobs(180000); // 3 minutes

    if (orphanedJobs.length > 0) {
      console.log(`ðŸ”§ [Cron] Found ${orphanedJobs.length} orphaned jobs, marking as INTERRUPTED`);

      for (const orphanJob of orphanedJobs) {
        try {
          orphanJob.markInterrupted();
          await repository.update(orphanJob);
          console.log(`âœ… [Cron] Job ${orphanJob.id} marked as INTERRUPTED and will be recovered`);
        } catch (error) {
          console.error(`âŒ [Cron] Error marking job ${orphanJob.id} as INTERRUPTED:`, error);
        }
      }
    }

    // 2. FIND RESUMABLE JOBS (PENDING, INTERRUPTED, PAUSED)
    const resumableJobs = await repository.findResumableJobs({ types: undefined });
    const pendingJobs = resumableJobs.filter(j => j.status === 'PENDING' || j.status === 'QUEUED');
    const interruptedJobs = resumableJobs.filter(j => j.status === 'INTERRUPTED' || j.status === 'PAUSED');

    // 3. FIND WAITING JOBS (already started but waiting for continuation)
    const waitingJobs = await repository.findWaitingJobs(5);

    // 4. COMBINE: INTERRUPTED first (recovery priority), then PENDING (FIFO), then WAITING
    const jobsToProcess = [...interruptedJobs, ...pendingJobs, ...waitingJobs].slice(0, 5);

    if (jobsToProcess.length === 0) {
      console.log("ðŸ’¤ [Cron] No jobs to process");
      return NextResponse.json({
        success: true,
        message: "No jobs to process",
        processed: 0,
        recovered: orphanedJobs.length,
        duration: Date.now() - startTime,
      });
    }

    console.log(`ðŸ“‹ [Cron] Found ${jobsToProcess.length} jobs to process (${interruptedJobs.length} interrupted, ${pendingJobs.length} pending, ${waitingJobs.length} waiting)`);

    const results: Array<{
      jobId: string;
      jobName: string;
      success: boolean;
      status: string;
      processedRecords: number;
      totalRecords: number;
      percentage: number;
      hasMore: boolean;
      lockAcquired?: boolean;
      wasPending?: boolean;
      wasInterrupted?: boolean;
      engine?: string;
      error?: string;
    }> = [];

    // Process each job
    for (const job of jobsToProcess) {
      const jobStartTime = Date.now();
      const engine = (job.metadata?.engine as string) || "legacy";
      console.log(`\nðŸ”„ [Cron] Processing job ${job.id} (${job.name}) [engine: ${engine}]`);

      try {
        const wasPending = job.status === 'PENDING' || job.status === 'QUEUED';
        const wasInterrupted = job.status === 'INTERRUPTED' || job.status === 'PAUSED';

        // 1. For WAITING jobs, try to acquire lock atomically
        //    For PENDING/INTERRUPTED jobs, start/continue them directly
        let lockAcquired = true;

        if (!wasPending && !wasInterrupted) {
          lockAcquired = await repository.tryAcquireJobLock(job.id);

          if (!lockAcquired) {
            console.log(`â­ï¸  [Cron] Job ${job.id} already being processed by another instance, skipping`);
            results.push({
              jobId: job.id,
              jobName: job.name,
              success: true,
              status: "SKIPPED",
              processedRecords: 0,
              totalRecords: 0,
              percentage: 0,
              hasMore: true,
              lockAcquired: false,
              engine,
            });
            continue;
          }

          console.log(`ðŸ”’ [Cron] Lock acquired for job ${job.id}`);
        }

        // ========================================
        // 2. DISPATCH based on engine
        // ========================================
        if (engine === "bulkimport") {
          // @batchactions/import engine
          const jobResult = await processBulkImportJob(job.id, job.metadata, job.createdBy, wasPending, wasInterrupted);
          results.push({ ...jobResult, jobName: job.name, engine });
        } else {
          // Legacy engine (BatchJobOrchestrator)
          const result = wasPending
            ? await orchestrator.start(job.id)
            : await orchestrator.continue(job.id);

          results.push({
            jobId: job.id,
            jobName: job.name,
            success: result.chunkResult.success,
            status: result.job.status,
            processedRecords: result.chunkResult.progress.processedRecords,
            totalRecords: result.chunkResult.progress.totalRecords,
            percentage: result.chunkResult.progress.percentage,
            hasMore: result.chunkResult.progress.hasMore,
            lockAcquired: true,
            wasPending,
            wasInterrupted,
            engine,
          });
        }

        const lastResult = results[results.length - 1];
        const duration = Date.now() - jobStartTime;
        console.log(
          `âœ… [Cron] Job ${job.id} [${engine}] processed: ${lastResult.processedRecords}/${lastResult.totalRecords} (${lastResult.percentage}%) in ${duration}ms`
        );

        if (!lastResult.hasMore) {
          console.log(`ðŸŽ‰ [Cron] Job ${job.id} completed!`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`âŒ [Cron] Error processing job ${job.id} [${engine}]:`, error);

        results.push({
          jobId: job.id,
          jobName: job.name,
          success: false,
          status: "ERROR",
          processedRecords: 0,
          totalRecords: 0,
          percentage: 0,
          hasMore: false,
          error: errorMessage,
          engine,
        });
      }

      // 3. Check if we're running out of time (Vercel cron timeout)
      const elapsed = Date.now() - startTime;
      if (elapsed > 50000) {
        // 50 seconds - leave 10s buffer for response
        console.warn(
          `â° [Cron] Approaching timeout (${elapsed}ms), stopping after processing ${results.length} jobs`
        );
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const skippedCount = results.filter((r) => r.lockAcquired === false).length;
    const startedCount = results.filter((r) => r.wasPending).length;
    const resumedCount = results.filter((r) => r.wasInterrupted).length;

    console.log(
      `\nðŸ [Cron] Batch processing complete: ${successCount}/${results.length} jobs successful (${startedCount} started, ${resumedCount} resumed, ${skippedCount} skipped, ${orphanedJobs.length} recovered) in ${totalDuration}ms`
    );

    return NextResponse.json(
      {
        success: true,
        message: `Processed ${results.length} jobs (${successCount} successful, ${startedCount} started, ${resumedCount} resumed, ${skippedCount} skipped, ${orphanedJobs.length} recovered)`,
        processed: results.length,
        successful: successCount,
        started: startedCount,
        resumed: resumedCount,
        skipped: skippedCount,
        recovered: orphanedJobs.length,
        failed: results.length - successCount - skippedCount,
        duration: totalDuration,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("âŒ [Cron] Fatal error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      },
      { status: 500 }
    );
  }
}

// ============================================================
// BulkImport engine handler
// ============================================================

/**
 * Procesa un job con @batchactions/import.
 * Extrae import_context del metadata y llama a resumeImport().
 *
 * Para jobs PENDING: el primer chunk se procesÃ³ en el POST /api/import,
 * pero si no fue asÃ­ (ej. el POST fallÃ³ despuÃ©s de crear el job), el
 * resumeImport() tambiÃ©n maneja ese caso.
 */
async function processBulkImportJob(
  jobId: string,
  metadata: Record<string, unknown>,
  createdBy: string,
  wasPending: boolean,
  wasInterrupted: boolean
): Promise<{
  jobId: string;
  success: boolean;
  status: string;
  processedRecords: number;
  totalRecords: number;
  percentage: number;
  hasMore: boolean;
  lockAcquired: boolean;
  wasPending: boolean;
  wasInterrupted: boolean;
}> {
  const importContext = metadata.import_context as ImportContext | undefined;

  if (!importContext?.s3Url) {
    throw new Error(`BulkImport job ${jobId} missing import_context.s3Url in metadata`);
  }

  const service = getBulkImportService();
  const result = await service.resumeImport({
    jobId,
    s3Url: importContext.s3Url,
    userId: createdBy,
    fileName: importContext.fileName,
    delimiter: importContext.delimiter,
    sharePointAuth: importContext.sharePointAuth,
    maxDurationMs: CRON_MAX_DURATION_MS,
    skipDuplicates: importContext.skipDuplicates,
  });

  const hasMore = !result.chunk.done;

  return {
    jobId,
    success: true,
    status: hasMore ? "WAITING" : "COMPLETED",
    processedRecords: result.progress.processedRecords,
    totalRecords: result.progress.totalRecords,
    percentage: result.progress.percentage,
    hasMore,
    lockAcquired: true,
    wasPending,
    wasInterrupted,
  };
}

/**
 * GET /api/cron/process-waiting-jobs
 * Called by Vercel Cron (every minute)
 */
export async function GET(request: NextRequest) {
  return processWaitingJobs(request);
}

/**
 * POST /api/cron/process-waiting-jobs
 * Manual trigger (for testing and development)
 */
export async function POST(request: NextRequest) {
  return processWaitingJobs(request);
}

