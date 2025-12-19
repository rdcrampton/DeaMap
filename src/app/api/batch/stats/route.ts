/**
 * Batch Job Statistics API
 *
 * GET /api/batch/stats - Get batch job statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { GetJobStatsUseCase } from "@/batch/application/use-cases";

const repository = new PrismaBatchJobRepository(prisma);

/**
 * GET /api/batch/stats
 * Get batch job statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const organizationId = searchParams.get("organizationId") ?? undefined;
    const dateFrom = searchParams.get("dateFrom")
      ? new Date(searchParams.get("dateFrom")!)
      : undefined;
    const dateTo = searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined;

    const useCase = new GetJobStatsUseCase(repository);
    const result = await useCase.execute({
      organizationId,
      dateFrom,
      dateTo,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stats: result.stats,
    });
  } catch (error) {
    console.error("Error getting batch job stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
