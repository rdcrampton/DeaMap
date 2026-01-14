/**
 * Cron Job: Process Waiting Batch Jobs
 *
 * This endpoint is called by Vercel Cron (every minute) to automatically
 * continue processing batch jobs that are in WAITING status.
 *
 * Flow:
 * 1. Find jobs in WAITING status
 * 2. For each job, call orchestrator.continue()
 * 3. Process multiple chunks (up to timeout)
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

const repository = new PrismaBatchJobRepository(prisma);
const dataSourceRepository = new PrismaDataSourceRepository(prisma);

// Initialize processors
initializeProcessors(prisma, dataSourceRepository);

const orchestrator = new BatchJobOrchestrator(repository);

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
      console.warn("🚫 [Cron] Unauthorized cron request");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    console.log("⏰ [Cron] Starting batch job processing...");

    // 1. RECOVER ORPHANED JOBS (IN_PROGRESS without heartbeat for >3 minutes)
    const orphanedJobs = await repository.findTimedOutJobs(180000); // 3 minutes
    
    if (orphanedJobs.length > 0) {
      console.log(`🔧 [Cron] Found ${orphanedJobs.length} orphaned jobs, marking as INTERRUPTED`);
      
      for (const orphanJob of orphanedJobs) {
        try {
          orphanJob.markInterrupted();
          await repository.update(orphanJob);
          console.log(`✅ [Cron] Job ${orphanJob.id} marked as INTERRUPTED and will be recovered`);
        } catch (error) {
          console.error(`❌ [Cron] Error marking job ${orphanJob.id} as INTERRUPTED:`, error);
        }
      }
    }

    // 2. FIND PENDING JOBS (not started yet)
    const pendingJobs = await repository.findResumableJobs({ types: undefined });
    const justPendingJobs = pendingJobs.filter(j => j.status === 'PENDING' || j.status === 'QUEUED');
    
    // 3. FIND WAITING JOBS (already started but waiting for continuation)
    const waitingJobs = await repository.findWaitingJobs(5);
    
    // 4. COMBINE: PENDING jobs first (FIFO), then WAITING jobs
    const jobsToProcess = [...justPendingJobs, ...waitingJobs].slice(0, 5);

    if (jobsToProcess.length === 0) {
      console.log("💤 [Cron] No jobs to process");
      return NextResponse.json({
        success: true,
        message: "No jobs to process",
        processed: 0,
        recovered: orphanedJobs.length,
        duration: Date.now() - startTime,
      });
    }

    console.log(`📋 [Cron] Found ${jobsToProcess.length} jobs to process (${justPendingJobs.length} pending, ${waitingJobs.length} waiting)`);

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
      error?: string;
    }> = [];

    // Process each job
    for (const job of jobsToProcess) {
      const jobStartTime = Date.now();
      console.log(`\n🔄 [Cron] Processing job ${job.id} (${job.name})`);

      try {
        const wasPending = job.status === 'PENDING' || job.status === 'QUEUED';
        
        // 1. For WAITING jobs, try to acquire lock atomically
        //    For PENDING jobs, start them directly
        let lockAcquired = true;
        
        if (!wasPending) {
          lockAcquired = await repository.tryAcquireJobLock(job.id);

          if (!lockAcquired) {
            console.log(`⏭️  [Cron] Job ${job.id} already being processed by another instance, skipping`);
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
            });
            continue;
          }

          console.log(`🔒 [Cron] Lock acquired for job ${job.id}`);
        }

        // 2. Process the job (start or continue depending on state)
        const result = wasPending 
          ? await orchestrator.start(job.id)
          : await orchestrator.continue(job.id);

        const jobResult = {
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
        };

        results.push(jobResult);

        const duration = Date.now() - jobStartTime;
        console.log(
          `✅ [Cron] Job ${job.id} processed: ${jobResult.processedRecords}/${jobResult.totalRecords} (${jobResult.percentage}%) in ${duration}ms`
        );

        if (!jobResult.hasMore) {
          console.log(`🎉 [Cron] Job ${job.id} completed!`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ [Cron] Error processing job ${job.id}:`, error);

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
        });
      }

      // 3. Check if we're running out of time (Vercel cron timeout)
      const elapsed = Date.now() - startTime;
      if (elapsed > 50000) {
        // 50 seconds - leave 10s buffer for response
        console.warn(
          `⏰ [Cron] Approaching timeout (${elapsed}ms), stopping after processing ${results.length} jobs`
        );
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const skippedCount = results.filter((r) => r.lockAcquired === false).length;
    const startedCount = results.filter((r) => r.wasPending).length;

    console.log(
      `\n🏁 [Cron] Batch processing complete: ${successCount}/${results.length} jobs successful (${startedCount} started, ${skippedCount} skipped, ${orphanedJobs.length} recovered) in ${totalDuration}ms`
    );

    return NextResponse.json(
      {
        success: true,
        message: `Processed ${results.length} jobs (${successCount} successful, ${startedCount} started, ${skippedCount} skipped, ${orphanedJobs.length} recovered)`,
        processed: results.length,
        successful: successCount,
        started: startedCount,
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
    console.error("❌ [Cron] Fatal error:", error);

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
