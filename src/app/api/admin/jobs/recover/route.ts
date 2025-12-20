/**
 * Admin API - Recover Stuck Jobs
 *
 * POST /api/admin/jobs/recover
 * Automatically detect and recover stuck batch jobs
 *
 * Only accessible for users with ADMIN role
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PrismaBatchJobRepository } from "@/batch/infrastructure";
import { RecoverStuckJobsUseCase } from "@/batch/application/use-cases";

const repository = new PrismaBatchJobRepository(prisma);

/**
 * POST /api/admin/jobs/recover
 * Recover stuck jobs automatically
 */
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const useCase = new RecoverStuckJobsUseCase(repository);
    const result = await useCase.execute({
      stuckThresholdMs: body.stuckThresholdMs,
      maxJobsToRecover: body.maxJobsToRecover ?? 10,
      dryRun: body.dryRun === true,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Error al recuperar jobs",
          details: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        recoveredJobs: result.recoveredJobs,
        totalStuckJobs: result.totalStuckJobs,
        dryRun: body.dryRun === true,
      },
      message:
        result.recoveredJobs.length > 0
          ? `${result.recoveredJobs.length} job(s) recuperados de ${result.totalStuckJobs} atascados`
          : "No se encontraron jobs atascados",
    });
  } catch (error) {
    console.error("[API] Error recovering stuck jobs:", error);
    return NextResponse.json(
      {
        error: "Error al recuperar jobs atascados",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
