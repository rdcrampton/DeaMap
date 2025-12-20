/**
 * Admin API - Get Data Source Current Job
 *
 * GET /api/admin/data-sources/[id]/current-job
 * Get the current active job for a specific data source
 *
 * Only accessible for users with ADMIN role
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { GetDataSourceCurrentJobUseCase } from "@/batch/application/use-cases";

const repository = new PrismaBatchJobRepository(prisma);

/**
 * GET /api/admin/data-sources/[id]/current-job
 * Get current job for a data source
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const useCase = new GetDataSourceCurrentJobUseCase(repository);
    const result = await useCase.execute({ dataSourceId: id });

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Error al obtener job actual",
          details: result.error,
        },
        { status: 500 }
      );
    }

    // Convert job to JSON if exists
    const jobData = result.job ? result.job.toDetailedJSON() : null;

    return NextResponse.json({
      success: true,
      data: jobData,
      message: jobData
        ? `Job encontrado: ${jobData.status}`
        : "No hay jobs activos para este data source",
    });
  } catch (error) {
    console.error("[API] Error getting current job:", error);
    return NextResponse.json(
      {
        error: "Error al obtener job actual",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
