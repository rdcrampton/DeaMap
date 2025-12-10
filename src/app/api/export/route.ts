/**
 * API Routes para exportación de AEDs a CSV
 * POST /api/export - Crear nueva exportación
 * GET /api/export - Listar exportaciones
 */

import { waitUntil } from "@vercel/functions";
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
 * Crear nueva exportación usando Vercel Background Functions (Pro)
 * El proceso de exportación se ejecuta en background después de enviar la respuesta
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, filters, format } = body as {
      name?: string;
      description?: string;
      filters?: ExportFilters;
      format?: "legacy" | "import_format";
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

    // Ejecutar exportación en background usando waitUntil de Vercel
    // Con Vercel Pro, esto permite hasta 15 minutos de ejecución
    const useCase = new GenerateExportUseCase(repository, prisma);
    waitUntil(
      useCase
        .execute({
          batchId,
          format: format || "import_format", // Por defecto usar formato de importación
        })
        .catch((error) => {
          console.error("Background export error:", error);
          // El batch ya se marca como FAILED en el use case
        })
    );

    // Responder inmediatamente mientras el proceso continúa en background
    return NextResponse.json(
      {
        success: true,
        message: "Exportación iniciada en segundo plano",
        batchId,
      },
      { status: 202 } // 202 Accepted - indica que la solicitud fue aceptada pero aún se está procesando
    );
  } catch (error) {
    console.error("Create export error:", error);
    return NextResponse.json({ error: "Error al crear exportación" }, { status: 500 });
  }
}
