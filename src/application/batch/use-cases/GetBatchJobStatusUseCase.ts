/**
 * Get Batch Job Status Use Case
 *
 * Returns the current status and progress of a batch job.
 */

import { BatchJobOrchestrator } from '../orchestrator';
import { BatchJob, JobProgress, JobResult, JobStatus } from '@/domain/batch';

export interface GetBatchJobStatusInput {
  jobId: string;
  includeResult?: boolean;
}

export interface GetBatchJobStatusOutput {
  success: boolean;
  job?: {
    id: string;
    type: string;
    name: string;
    description?: string;
    status: JobStatus;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    durationMs: number;
    resumeCount: number;
    tags: string[];
  };
  progress?: {
    totalRecords: number;
    processedRecords: number;
    successfulRecords: number;
    failedRecords: number;
    skippedRecords: number;
    warningRecords: number;
    percentage: number;
    hasMore: boolean;
    estimatedRemainingMs: number | null;
  };
  result?: {
    summary: {
      totalRecords: number;
      successfulRecords: number;
      failedRecords: number;
      createdRecords: number;
      updatedRecords: number;
      deletedRecords: number;
      durationMs: number;
    };
    errorCount: number;
    warningCount: number;
    hasArtifacts: boolean;
  };
  canContinue?: boolean;
  canCancel?: boolean;
  isComplete?: boolean;
  error?: string;
}

export class GetBatchJobStatusUseCase {
  constructor(private readonly orchestrator: BatchJobOrchestrator) {}

  async execute(input: GetBatchJobStatusInput): Promise<GetBatchJobStatusOutput> {
    try {
      const status = await this.orchestrator.getStatus(input.jobId);
      const { job, canContinue, canCancel, isComplete, progress } = status;

      const output: GetBatchJobStatusOutput = {
        success: true,
        job: {
          id: job.id,
          type: job.type,
          name: job.name,
          description: job.description,
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          startedAt: job.startedAt?.toISOString(),
          completedAt: job.completedAt?.toISOString(),
          durationMs: job.durationMs,
          resumeCount: job.resumeCount,
          tags: job.tags,
        },
        progress: {
          totalRecords: progress.totalRecords,
          processedRecords: progress.processedRecords,
          successfulRecords: progress.successfulRecords,
          failedRecords: progress.failedRecords,
          skippedRecords: progress.skippedRecords,
          warningRecords: progress.warningRecords,
          percentage: progress.percentage,
          hasMore: progress.hasMore,
          estimatedRemainingMs: progress.estimatedRemainingMs,
        },
        canContinue,
        canCancel,
        isComplete,
      };

      if (input.includeResult && isComplete) {
        const result = job.result;
        output.result = {
          summary: result.summary,
          errorCount: result.errorCount,
          warningCount: result.warningCount,
          hasArtifacts: result.hasArtifacts,
        };
      }

      return output;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
