/**
 * Retry Batch Job API
 *
 * POST /api/batch/[jobId]/retry - Retry a failed job
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/client';
import { PrismaBatchJobRepository } from '@/infrastructure/batch';
import { BatchJobOrchestrator } from '@/application/batch';
import { RetryBatchJobUseCase } from '@/application/batch/use-cases';
import { initializeProcessors } from '@/application/batch/processors';
import { PrismaDataSourceRepository } from '@/infrastructure/import/repositories/PrismaDataSourceRepository';

const prisma = new PrismaClient();
const repository = new PrismaBatchJobRepository(prisma);
const dataSourceRepository = new PrismaDataSourceRepository(prisma);

// Initialize processors
initializeProcessors(prisma, dataSourceRepository);

const orchestrator = new BatchJobOrchestrator(repository);

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/batch/[jobId]/retry
 * Retry a failed batch job
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { jobId } = await params;

    const useCase = new RetryBatchJobUseCase(orchestrator);
    const result = await useCase.execute({ jobId });

    if (!result.success) {
      const status = result.error?.includes('not found') ? 404 :
                     result.error?.includes('Can only retry') ? 400 : 500;
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      newJob: result.newJob?.toJSON(),
      progress: result.chunkResult?.progress,
      shouldContinue: result.chunkResult?.shouldContinue,
      message: 'Job retry started',
    }, { status: 202 });
  } catch (error) {
    console.error('Error retrying batch job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
