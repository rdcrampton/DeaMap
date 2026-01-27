/**
 * Get Data Source Current Job Use Case
 *
 * Domain: Batch Job Monitoring for Data Sources
 * Responsibility: Get the current active job for a specific data source
 *
 * SOLID Principles:
 * - SRP: Single responsibility - fetch current job for data source
 * - DIP: Depends on IBatchJobRepository abstraction
 * - OCP: Open for extension
 */

import { IBatchJobRepository, JobStatus, BatchJob } from "@/batch/domain";

export interface GetDataSourceCurrentJobInput {
  dataSourceId: string;
}

export interface GetDataSourceCurrentJobOutput {
  success: boolean;
  job: BatchJob | null;
  error?: string;
}

export class GetDataSourceCurrentJobUseCase {
  constructor(private readonly repository: IBatchJobRepository) {}

  async execute(input: GetDataSourceCurrentJobInput): Promise<GetDataSourceCurrentJobOutput> {
    try {
      // Get the most recent active or recently completed job for this data source
      const result = await this.repository.findMany(
        {
          dataSourceId: input.dataSourceId,
          statuses: [
            JobStatus.PENDING,
            JobStatus.IN_PROGRESS,
            JobStatus.RESUMING,
            JobStatus.WAITING,
            JobStatus.PAUSED,
            JobStatus.INTERRUPTED,
            JobStatus.QUEUED,
          ],
        },
        { page: 1, pageSize: 1 },
        { field: "updatedAt", direction: "desc" }
      );

      const activeJob = result.jobs[0] ?? null;

      // If no active job, get the most recent completed/failed job for reference
      if (!activeJob) {
        const recentResult = await this.repository.findMany(
          {
            dataSourceId: input.dataSourceId,
            statuses: [
              JobStatus.COMPLETED,
              JobStatus.COMPLETED_WITH_WARNINGS,
              JobStatus.FAILED,
              JobStatus.CANCELLED,
            ],
          },
          { page: 1, pageSize: 1 },
          { field: "updatedAt", direction: "desc" }
        );

        const recentJob = recentResult.jobs[0] ?? null;

        return {
          success: true,
          job: recentJob,
        };
      }

      return {
        success: true,
        job: activeJob,
      };
    } catch (error) {
      console.error("[GetDataSourceCurrentJob] Error:", error);
      return {
        success: false,
        job: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
