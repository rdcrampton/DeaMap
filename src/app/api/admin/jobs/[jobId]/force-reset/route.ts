/**
 * Admin API - Force Reset Job
 *
 * POST /api/admin/jobs/[jobId]/force-reset
 * Force reset a specific stuck job (admin action)
 *
 * Only accessible for users with ADMIN role
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { ForceResetJobUseCase } from "@/batch/application/use-cases";

const repository = new PrismaBatchJobRepository(prisma);

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/admin/jobs/[jobId]/force-reset
 * Force reset a specific stuck job
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { jobId } = await params;
    const body = await request.json();

    if (!body.reason) {
      return NextResponse.json(
        {
          error: "El campo 'reason' es obligatorio",
        },
        { status: 400 }
      );
    }

    const useCase = new ForceResetJobUseCase(repository);
    const result = await useCase.execute({
      jobId,
      reason: body.reason,
      performedBy: user.userId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Error al resetear el job",
          details: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: result.job!.id,
        name: result.job!.name,
        previousStatus: result.job!.metadata.forceResetPreviousStatus,
        newStatus: result.job!.status,
        canResume: result.job!.canResume,
      },
      message: result.message,
    });
  } catch (error) {
    console.error("[API] Error force-resetting job:", error);
    return NextResponse.json(
      {
        error: "Error al resetear el job",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
