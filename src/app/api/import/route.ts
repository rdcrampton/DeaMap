/**
 * Import Batches API
 *
 * GET /api/import - List import batches (filtered by AED_CSV_IMPORT type)
 *
 * This is a convenience endpoint that wraps the generic batch job API
 * with filtering for CSV imports and transforms the response to the
 * legacy format expected by the frontend.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { JobType } from "@/batch/domain";

/**
 * GET /api/import
 * List import batches with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const skip = (page - 1) * limit;

    // Query batch jobs of type AED_CSV_IMPORT
    const [jobs, total] = await Promise.all([
      prisma.batchJob.findMany({
        where: {
          type: JobType.AED_CSV_IMPORT,
        },
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              errors: true,
              created_aeds: true,
            },
          },
          artifacts: {
            where: {
              type: "FILE",
            },
            take: 1,
          },
        },
      }),
      prisma.batchJob.count({
        where: {
          type: JobType.AED_CSV_IMPORT,
        },
      }),
    ]);

    // Transform to legacy format expected by frontend
    const batches = jobs.map((job) => {
      const config = job.config as Record<string, unknown>;
      const sourceFile = job.artifacts[0];

      return {
        id: job.id,
        name: job.name,
        description: job.description,
        source_origin: (config?.sourceOrigin as string) ?? "CSV_IMPORT",
        file_name: sourceFile?.name ?? (config?.fileName as string) ?? null,
        file_url: sourceFile?.file_url ?? (config?.fileUrl as string) ?? null,
        file_size: sourceFile?.file_size ?? (config?.fileSize as number) ?? null,
        total_records: job.total_records,
        successful_records: job.successful_records,
        failed_records: job.failed_records,
        warning_records: job.skipped_records,
        status: job.status,
        completed_at: job.completed_at?.toISOString() ?? null,
        duration_seconds: job.duration_seconds,
        imported_by: job.created_by,
        created_at: job.created_at.toISOString(),
        _count: {
          errors: job._count.errors,
          aeds: job._count.created_aeds,
        },
      };
    });

    return NextResponse.json({
      batches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing import batches:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
