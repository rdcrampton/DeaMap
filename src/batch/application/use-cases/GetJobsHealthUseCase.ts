/**
 * Get Jobs Health Use Case
 *
 * Domain: Batch Job Monitoring
 * Responsibility: Provide health status of the batch job system
 *
 * SOLID Principles:
 * - SRP: Single responsibility - gather health metrics
 * - DIP: Depends on IBatchJobRepository abstraction
 * - OCP: Open for extension (can add more health metrics)
 */

import { IBatchJobRepository, JobStatus } from "@/batch/domain";

export interface JobHealthMetrics {
  totalActive: number;
  totalStuck: number;
  totalWaiting: number;
  totalInterrupted: number;
  activeJobs: Array<{
    jobId: string;
    name: string;
    status: JobStatus;
    isStuck: boolean;
    timeSinceLastHeartbeat: number | null;
    startedAt: string | null;
    progress: number;
  }>;
}

export interface GetJobsHealthOutput {
  success: boolean;
  healthy: boolean;
  metrics: JobHealthMetrics;
  issues: string[];
  recommendations: string[];
  error?: string;
}

export class GetJobsHealthUseCase {
  constructor(private readonly repository: IBatchJobRepository) {}

  async execute(): Promise<GetJobsHealthOutput> {
    try {
      // Get all active jobs
      const activeResult = await this.repository.findMany(
        {
          statuses: [
            JobStatus.IN_PROGRESS,
            JobStatus.RESUMING,
            JobStatus.WAITING,
            JobStatus.PAUSED,
          ],
        },
        { page: 1, pageSize: 100 }
      );
      const activeJobs = activeResult.jobs;

      // Calculate metrics
      const stuckJobs = activeJobs.filter((job) => job.isStuck);
      const waitingJobs = activeJobs.filter((job) => job.status === JobStatus.WAITING);
      const interruptedJobs = await this.repository.findMany(
        { statuses: [JobStatus.INTERRUPTED] },
        { page: 1, pageSize: 100 }
      );

      const metrics: JobHealthMetrics = {
        totalActive: activeJobs.length,
        totalStuck: stuckJobs.length,
        totalWaiting: waitingJobs.length,
        totalInterrupted: interruptedJobs.jobs.length,
        activeJobs: activeJobs.map((job) => ({
          jobId: job.id,
          name: job.name,
          status: job.status,
          isStuck: job.isStuck,
          timeSinceLastHeartbeat: job.timeSinceLastHeartbeat,
          startedAt: job.startedAt?.toISOString() ?? null,
          progress: job.progress.percentage,
        })),
      };

      // Identify issues
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (stuckJobs.length > 0) {
        issues.push(`${stuckJobs.length} job(s) are stuck without heartbeat`);
        recommendations.push("Run automatic recovery or manually reset stuck jobs");
      }

      if (interruptedJobs.jobs.length > 0) {
        issues.push(`${interruptedJobs.jobs.length} job(s) are in INTERRUPTED state`);
        recommendations.push("Resume interrupted jobs to continue processing");
      }

      if (waitingJobs.length > 5) {
        issues.push(`${waitingJobs.length} job(s) are waiting for continuation`);
        recommendations.push("Check if polling mechanism is working correctly");
      }

      // System is healthy if no stuck jobs and few interruptions
      const healthy = stuckJobs.length === 0 && interruptedJobs.jobs.length < 3;

      return {
        success: true,
        healthy,
        metrics,
        issues,
        recommendations,
      };
    } catch (error) {
      console.error("[GetJobsHealth] Error:", error);
      return {
        success: false,
        healthy: false,
        metrics: {
          totalActive: 0,
          totalStuck: 0,
          totalWaiting: 0,
          totalInterrupted: 0,
          activeJobs: [],
        },
        issues: ["Failed to retrieve health metrics"],
        recommendations: ["Check database connection and repository implementation"],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
