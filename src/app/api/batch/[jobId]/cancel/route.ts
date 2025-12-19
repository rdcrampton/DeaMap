/**
 * Cancel Batch Job API
 *
 * POST /api/batch/[jobId]/cancel - Cancel a running job
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/client';
import { PrismaBatchJobRepository } from '@/infrastructure/batch';
import { BatchJobOrchestrator } from '@/application/batch';
import { CancelBatchJobUseCase } from '@/application/batch/use-cases';
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
 * POST /api/batch/[jobId]/cancel
 * Cancel a batch job
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { jobId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason as string | undefined;

    const useCase = new CancelBatchJobUseCase(orchestrator);
    const result = await useCase.execute({ jobId, reason });

    if (!result.success) {
      const status = result.error?.includes('not found') ? 404 :
                     result.error?.includes('Cannot cancel') ? 400 : 500;
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      job: result.job?.toJSON(),
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling batch job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
