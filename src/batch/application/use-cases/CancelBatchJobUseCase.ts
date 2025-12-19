/**
 * Cancel Batch Job Use Case
 *
 * Cancels a running or paused batch job.
 */

import { BatchJobOrchestrator } from "../orchestrator";
import { BatchJob } from "@/batch/domain";

export interface CancelBatchJobInput {
  jobId: string;
  reason?: string;
}

export interface CancelBatchJobOutput {
  success: boolean;
  job?: BatchJob;
  error?: string;
}

export class CancelBatchJobUseCase {
  constructor(private readonly orchestrator: BatchJobOrchestrator) {}

  async execute(input: CancelBatchJobInput): Promise<CancelBatchJobOutput> {
    try {
      const job = await this.orchestrator.cancel(input.jobId, input.reason);

      return {
        success: true,
        job,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Pause Batch Job Use Case
 */
export interface PauseBatchJobInput {
  jobId: string;
}

export interface PauseBatchJobOutput {
  success: boolean;
  job?: BatchJob;
  error?: string;
}

export class PauseBatchJobUseCase {
  constructor(private readonly orchestrator: BatchJobOrchestrator) {}

  async execute(input: PauseBatchJobInput): Promise<PauseBatchJobOutput> {
    try {
      const job = await this.orchestrator.pause(input.jobId);

      return {
        success: true,
        job,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Retry Failed Job Use Case
 */
export interface RetryBatchJobInput {
  jobId: string;
}

export interface RetryBatchJobOutput {
  success: boolean;
  newJob?: BatchJob;
  chunkResult?: {
    progress: {
      totalRecords: number;
      processedRecords: number;
      percentage: number;
      hasMore: boolean;
    };
    shouldContinue: boolean;
  };
  error?: string;
}

export class RetryBatchJobUseCase {
  constructor(private readonly orchestrator: BatchJobOrchestrator) {}

  async execute(input: RetryBatchJobInput): Promise<RetryBatchJobOutput> {
    try {
      const result = await this.orchestrator.retry(input.jobId);

      return {
        success: true,
        newJob: result.job,
        chunkResult: {
          progress: result.chunkResult.progress,
          shouldContinue: result.chunkResult.shouldContinue,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
