/**
 * List Batch Jobs Use Case
 *
 * Lists batch jobs with filtering, pagination, and sorting.
 */

import {
  IBatchJobRepository,
  BatchJobFilter,
  BatchJobPagination,
  BatchJobSort,
  JobType,
  JobStatus,
} from '@/domain/batch';

export interface ListBatchJobsInput {
  // Filters
  types?: JobType[];
  statuses?: JobStatus[];
  createdBy?: string;
  organizationId?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;

  // Pagination
  page?: number;
  pageSize?: number;

  // Sorting
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
  sortDirection?: 'asc' | 'desc';
}

export interface ListBatchJobsOutput {
  success: boolean;
  jobs?: Array<{
    id: string;
    type: string;
    name: string;
    status: JobStatus;
    progress: {
      totalRecords: number;
      processedRecords: number;
      percentage: number;
    };
    createdBy: string;
    createdAt: string;
    completedAt?: string;
    tags: string[];
  }>;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export class ListBatchJobsUseCase {
  constructor(private readonly repository: IBatchJobRepository) {}

  async execute(input: ListBatchJobsInput): Promise<ListBatchJobsOutput> {
    try {
      const filter: BatchJobFilter = {
        types: input.types,
        statuses: input.statuses,
        createdBy: input.createdBy,
        organizationId: input.organizationId,
        tags: input.tags,
        createdAfter: input.createdAfter,
        createdBefore: input.createdBefore,
      };

      const pagination: BatchJobPagination = {
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 20,
      };

      const sort: BatchJobSort = {
        field: input.sortBy ?? 'createdAt',
        direction: input.sortDirection ?? 'desc',
      };

      const result = await this.repository.findMany(filter, pagination, sort);

      return {
        success: true,
        jobs: result.jobs.map(job => ({
          id: job.id,
          type: job.type,
          name: job.name,
          status: job.status,
          progress: {
            totalRecords: job.progress.totalRecords,
            processedRecords: job.progress.processedRecords,
            percentage: job.progress.percentage,
          },
          createdBy: job.createdBy,
          createdAt: job.createdAt.toISOString(),
          completedAt: job.completedAt?.toISOString(),
          tags: job.tags,
        })),
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get Active Jobs Use Case
 */
export interface GetActiveJobsInput {
  types?: JobType[];
  organizationId?: string;
  createdBy?: string;
}

export interface GetActiveJobsOutput {
  success: boolean;
  jobs?: Array<{
    id: string;
    type: string;
    name: string;
    status: JobStatus;
    progress: {
      totalRecords: number;
      processedRecords: number;
      percentage: number;
    };
  }>;
  error?: string;
}

export class GetActiveJobsUseCase {
  constructor(private readonly repository: IBatchJobRepository) {}

  async execute(input: GetActiveJobsInput): Promise<GetActiveJobsOutput> {
    try {
      const jobs = await this.repository.findActiveJobs({
        types: input.types,
        organizationId: input.organizationId,
        createdBy: input.createdBy,
      });

      return {
        success: true,
        jobs: jobs.map(job => ({
          id: job.id,
          type: job.type,
          name: job.name,
          status: job.status,
          progress: {
            totalRecords: job.progress.totalRecords,
            processedRecords: job.progress.processedRecords,
            percentage: job.progress.percentage,
          },
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get Job Statistics Use Case
 */
export interface GetJobStatsInput {
  organizationId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GetJobStatsOutput {
  success: boolean;
  stats?: {
    total: number;
    byStatus: Record<JobStatus, number>;
    byType: Record<JobType, number>;
    averageDurationMs: number;
    successRate: number;
  };
  error?: string;
}

export class GetJobStatsUseCase {
  constructor(private readonly repository: IBatchJobRepository) {}

  async execute(input: GetJobStatsInput): Promise<GetJobStatsOutput> {
    try {
      const stats = await this.repository.getStats({
        organizationId: input.organizationId,
        dateRange: input.dateFrom && input.dateTo
          ? { from: input.dateFrom, to: input.dateTo }
          : undefined,
      });

      return {
        success: true,
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
