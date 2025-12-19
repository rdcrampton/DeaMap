/**
 * Continue Batch Job Use Case
 *
 * Continues processing a batch job that is waiting for the next chunk.
 * Used for polling-based continuation in serverless environments.
 */

import { BatchJobOrchestrator, ChunkExecutionResult } from "../orchestrator";
import { BatchJob } from "@/batch/domain";

export interface ContinueBatchJobInput {
  jobId: string;
}

export interface ContinueBatchJobOutput {
  success: boolean;
  job?: BatchJob;
  chunkResult?: ChunkExecutionResult;
  error?: string;
  isComplete?: boolean;
}

export class ContinueBatchJobUseCase {
  constructor(private readonly orchestrator: BatchJobOrchestrator) {}

  async execute(input: ContinueBatchJobInput): Promise<ContinueBatchJobOutput> {
    try {
      const result = await this.orchestrator.continue(input.jobId);

      return {
        success: true,
        job: result.job,
        chunkResult: result.chunkResult,
        isComplete: result.job.isTerminal,
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
 * Start Batch Job Use Case
 *
 * Starts a pending batch job.
 */
export interface StartBatchJobInput {
  jobId: string;
}

export interface StartBatchJobOutput {
  success: boolean;
  job?: BatchJob;
  chunkResult?: ChunkExecutionResult;
  error?: string;
}

export class StartBatchJobUseCase {
  constructor(private readonly orchestrator: BatchJobOrchestrator) {}

  async execute(input: StartBatchJobInput): Promise<StartBatchJobOutput> {
    try {
      const result = await this.orchestrator.start(input.jobId);

      return {
        success: true,
        job: result.job,
        chunkResult: result.chunkResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
