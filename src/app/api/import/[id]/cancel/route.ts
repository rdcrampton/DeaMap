/**
 * Cancel Import API
 *
 * POST /api/import/[id]/cancel - Cancel a running or waiting import
 * 
 * This is a wrapper around the batch job cancel endpoint
 * to provide a cleaner API for the import UI
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { BatchJobOrchestrator } from "@/batch/application";
import { CancelBatchJobUseCase } from "@/batch/application/use-cases";
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
 * POST /api/import/[id]/cancel
 * Cancel an import (batch job)
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    console.log(`🚫 [Import Cancel] Cancelling import ${id}`);

    const useCase = new CancelBatchJobUseCase(orchestrator);
    const result = await useCase.execute({ jobId: id, reason: "Cancelled by user" });

    if (!result.success) {
      const status = result.error?.includes("not found")
        ? 404
        : result.error?.includes("Cannot cancel")
          ? 400
          : 500;
      
      console.error(`❌ [Import Cancel] Failed to cancel import ${id}:`, result.error);
      
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status });
    }

    console.log(`✅ [Import Cancel] Import ${id} cancelled successfully`);

    return NextResponse.json(
      {
        success: true,
        job: result.job?.toJSON(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ [Import Cancel] Unexpected error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
