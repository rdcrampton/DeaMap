/**
 * API Routes para exportación de AEDs a CSV
 * POST /api/export - Crear nueva exportación
 * GET /api/export - Listar exportaciones
 */

import { NextRequest, NextResponse } from "next/server";

import { GenerateExportUseCase } from "@/application/export/use-cases/GenerateExportUseCase";
import { ExportFilters } from "@/domain/export/ports/IExportRepository";
import { PrismaExportRepository } from "@/infrastructure/export/repositories/PrismaExportRepository";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/export
 * Listar exportaciones del usuario autenticado
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const repository = new PrismaExportRepository(prisma);
    const result = await repository.listBatches({
      page,
      limit,
      userId: user.userId,
    });

    return NextResponse.json({
      success: true,
      data: result.batches,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    console.error("List exports error:", error);
    return NextResponse.json({ error: "Error al listar exportaciones" }, { status: 500 });
  }
}

/**
 * POST /api/export
 * Crear nueva exportación (proceso síncrono para Vercel serverless)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, filters } = body as {
      name?: string;
      description?: string;
      filters?: ExportFilters;
    };

    // Validar filtros
    if (filters?.status && !Array.isArray(filters.status)) {
      return NextResponse.json({ error: "El filtro 'status' debe ser un array" }, { status: 400 });
    }

    // Crear batch
    const repository = new PrismaExportRepository(prisma);
    const batchId = await repository.createBatch({
      name: name || "Exportación de DEAs",
      description,
      filters,
      exportedBy: user.userId,
      ipAddress:
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
    });

    // Ejecutar exportación de forma síncrona
    // En Vercel serverless, los procesos en background se terminan cuando la respuesta es enviada
    const useCase = new GenerateExportUseCase(repository, prisma);
    try {
      await useCase.execute({ batchId });

      // Obtener información actualizada del batch
      const batchInfo = await repository.getBatchInfo(batchId);

      return NextResponse.json(
        {
          success: true,
          message: "Exportación completada",
          batchId,
          fileUrl: batchInfo?.fileUrl,
          totalRecords: batchInfo?.totalRecords,
        },
        { status: 200 }
      );
    } catch (exportError) {
      console.error("Export execution error:", exportError);
      // El batch ya se marcó como FAILED en el use case
      return NextResponse.json(
        {
          success: false,
          message: "Error durante la exportación",
          batchId,
          error: exportError instanceof Error ? exportError.message : "Error desconocido",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Create export error:", error);
    return NextResponse.json({ error: "Error al crear exportación" }, { status: 500 });
  }
}
