/**
 * Resume Import API
 *
 * POST /api/import/[id]/resume - Resume/continue a waiting or interrupted import
 * 
 * This is a wrapper around the batch job continue endpoint
 * to provide a cleaner API for the import UI
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { ContinueBatchJobUseCase } from "@/batch/application/use-cases";
import { initializeProcessors } from "@/batch/application/processors";
import { PrismaDataSourceRepository } from "@/import/infrastructure/repositories/PrismaDataSourceRepository";

const repository = new PrismaBatchJobRepository(prisma);
const dataSourceRepository = new PrismaDataSourceRepository(prisma);

// Initialize processors
initializeProcessors(prisma, dataSourceRepository);

const orchestrator = new BatchJobOrchestrator(repository);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/import/[id]/resume
 * Resume/continue an import (batch job)
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    console.log(`📥 [Import Resume] Resuming import ${id}`);

    const useCase = new ContinueBatchJobUseCase(orchestrator);
    const result = await useCase.execute({ jobId: id });

    if (!result.success) {
      const status = result.error?.includes("not found")
        ? 404
        : result.error?.includes("Cannot continue")
          ? 400
          : 500;
      
      console.error(`❌ [Import Resume] Failed to resume import ${id}:`, result.error);
      
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status });
    }

    console.log(
      `✅ [Import Resume] Import ${id} resumed: ${result.job?.progress.processedRecords}/${result.job?.progress.totalRecords} records`
    );

    return NextResponse.json(
      {
        success: true,
        job: result.job?.toJSON(),
        progress: result.chunkResult?.progress,
        shouldContinue: result.chunkResult?.shouldContinue,
        isComplete: result.isComplete,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ [Import Resume] Unexpected error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
