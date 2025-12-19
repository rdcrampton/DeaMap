/**
 * Create Batch Job Use Case
 *
 * Creates a new batch job with the given parameters.
 * Validates the configuration before creating.
 */

import { BatchJobOrchestrator, CreateJobParams } from '../orchestrator';
import { BatchJob } from '@/domain/batch';

export interface CreateBatchJobInput extends CreateJobParams {
  startImmediately?: boolean;
}

export interface CreateBatchJobOutput {
  success: boolean;
  job?: BatchJob;
  error?: string;
  started?: boolean;
  chunkResult?: {
    progress: {
      totalRecords: number;
      processedRecords: number;
      percentage: number;
      hasMore: boolean;
    };
    shouldContinue: boolean;
  };
}

export class CreateBatchJobUseCase {
  constructor(private readonly orchestrator: BatchJobOrchestrator) {}

  async execute(input: CreateBatchJobInput): Promise<CreateBatchJobOutput> {
    try {
      // Create the job
      const job = await this.orchestrator.create({
        type: input.type,
        name: input.name,
        description: input.description,
        config: input.config,
        createdBy: input.createdBy,
        organizationId: input.organizationId,
        metadata: input.metadata,
        tags: input.tags,
      });

      // Optionally start immediately
      if (input.startImmediately) {
        const result = await this.orchestrator.start(job.id);
        return {
          success: true,
          job: result.job,
          started: true,
          chunkResult: {
            progress: result.chunkResult.progress,
            shouldContinue: result.chunkResult.shouldContinue,
          },
        };
      }

      return {
        success: true,
        job,
        started: false,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
