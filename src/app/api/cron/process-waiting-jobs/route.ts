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
 * POST /api/cron/process-waiting-jobs
 * Automatically process waiting batch jobs
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify Vercel Cron Secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("🚫 [Cron] Unauthorized cron request");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    console.log("⏰ [Cron] Starting batch job processing...");

    // Find waiting jobs (limit to avoid overwhelming the system)
    const waitingJobs = await repository.findWaitingJobs(5); // Process max 5 jobs per cron run

    if (waitingJobs.length === 0) {
      console.log("💤 [Cron] No waiting jobs found");
      return NextResponse.json({
        success: true,
        message: "No waiting jobs to process",
        processed: 0,
        duration: Date.now() - startTime,
      });
    }

    console.log(`📋 [Cron] Found ${waitingJobs.length} waiting jobs`);

    const results: Array<{
      jobId: string;
      jobName: string;
      success: boolean;
      status: string;
      processedRecords: number;
      totalRecords: number;
      percentage: number;
      hasMore: boolean;
      error?: string;
    }> = [];

    // Process each job
    for (const job of waitingJobs) {
      const jobStartTime = Date.now();
      console.log(`\n🔄 [Cron] Processing job ${job.id} (${job.name})`);

      try {
        const result = await orchestrator.continue(job.id);

        const jobResult = {
          jobId: job.id,
          jobName: job.name,
          success: result.chunkResult.success,
          status: result.job.status,
          processedRecords: result.chunkResult.progress.processedRecords,
          totalRecords: result.chunkResult.progress.totalRecords,
          percentage: result.chunkResult.progress.percentage,
          hasMore: result.chunkResult.progress.hasMore,
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

      // Check if we're running out of time (Vercel cron has 10 second timeout for free plan)
      const elapsed = Date.now() - startTime;
      if (elapsed > 50000) {
        // 50 seconds - leave buffer for response
        console.warn(
          `⏰ [Cron] Approaching timeout (${elapsed}ms), stopping after processing ${results.length} jobs`
        );
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;

    console.log(
      `\n🏁 [Cron] Batch processing complete: ${successCount}/${results.length} jobs successful in ${totalDuration}ms`
    );

    return NextResponse.json(
      {
        success: true,
        message: `Processed ${results.length} jobs (${successCount} successful)`,
        processed: results.length,
        successful: successCount,
        failed: results.length - successCount,
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
 * Health check endpoint
 */
export async function GET() {
  try {
    const waitingJobs = await repository.findWaitingJobs(10);

    return NextResponse.json({
      success: true,
      message: "Cron endpoint is healthy",
      waitingJobs: waitingJobs.length,
      jobs: waitingJobs.map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        progress: {
          processedRecords: job.progress.processedRecords,
          totalRecords: job.progress.totalRecords,
          percentage: job.progress.percentage,
        },
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
