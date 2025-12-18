/**
 * Admin API para ejecutar sincronización de una fuente de datos
 * Solo accesible para usuarios con rol ADMIN
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ProcessExternalSourceUseCase } from "@/application/import/use-cases/ProcessExternalSourceUseCase";
import { PrismaImportRepository } from "@/infrastructure/import/repositories/PrismaImportRepository";
import { PrismaDataSourceRepository } from "@/infrastructure/import/repositories/PrismaDataSourceRepository";
import { PrismaCheckpointService } from "@/infrastructure/import/services/PrismaCheckpointService";
import { PrismaHeartbeatService } from "@/infrastructure/import/services/PrismaHeartbeatService";
import { DataSourceAdapterFactory } from "@/infrastructure/import/adapters/DataSourceAdapterFactory";
import type { DataSourceType } from "@/domain/import/ports/IDataSourceAdapter";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/data-sources/[id]/sync
 * Ejecuta la sincronización de una fuente de datos
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Verificar que la fuente existe y está activa
    const dataSource = await prisma.externalDataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      return NextResponse.json({ error: "Fuente de datos no encontrada" }, { status: 404 });
    }

    if (!dataSource.is_active) {
      return NextResponse.json({ error: "La fuente de datos no está activa" }, { status: 400 });
    }

    // Verificar que no hay otra sincronización en progreso
    const inProgressBatch = await prisma.importBatch.findFirst({
      where: {
        data_source_id: id,
        status: "IN_PROGRESS",
      },
    });

    if (inProgressBatch) {
      return NextResponse.json(
        {
          error: "Ya hay una sincronización en progreso",
          batchId: inProgressBatch.id,
        },
        { status: 409 }
      );
    }

    // Configurar opciones de sincronización
    const options = {
      dryRun: body.dryRun === true,
      forceFullSync: body.forceFullSync === true,
      maxRecords: body.maxRecords ? parseInt(body.maxRecords) : undefined,
      deactivateMissing: body.deactivateMissing ?? dataSource.auto_deactivate_missing,
      updateExistingFields: body.updateExistingFields ?? dataSource.auto_update_fields,
    };

    // Inicializar dependencias
    const importRepository = new PrismaImportRepository(prisma);
    const dataSourceRepository = new PrismaDataSourceRepository(prisma);
    const checkpointService = new PrismaCheckpointService(prisma);
    const heartbeatService = new PrismaHeartbeatService(prisma);

    // Función para crear adapters según el tipo
    const adapterFactory = (type: string) => {
      return DataSourceAdapterFactory.getApiAdapter(type as DataSourceType);
    };

    // Crear y ejecutar use case
    const useCase = new ProcessExternalSourceUseCase(
      importRepository,
      dataSourceRepository,
      checkpointService,
      heartbeatService,
      adapterFactory
    );

    // Ejecutar sincronización
    const result = await useCase.execute({
      dataSourceId: id,
      importedBy: user.userId,
      options,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        batchId: result.batchId,
        dataSourceId: result.dataSourceId,
        dryRun: result.dryRun,
        stats: result.stats,
        duration: result.duration,
        errors: result.errors.slice(0, 10), // Limitar errores en respuesta
        totalErrors: result.errors.length,
      },
      message: result.success
        ? `Sincronización completada: ${result.stats.created} creados, ${result.stats.updated} actualizados`
        : `Sincronización completada con ${result.stats.failed} errores`,
    });
  } catch (error) {
    console.error("Error during sync:", error);
    return NextResponse.json(
      {
        error: "Error durante la sincronización",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/data-sources/[id]/sync
 * Obtiene el estado de la última sincronización
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Obtener el último batch de esta fuente
    const lastBatch = await prisma.importBatch.findFirst({
      where: { data_source_id: id },
      orderBy: { created_at: "desc" },
      include: {
        errors: {
          take: 10,
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!lastBatch) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No hay sincronizaciones previas",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        batchId: lastBatch.id,
        name: lastBatch.name,
        status: lastBatch.status,
        totalRecords: lastBatch.total_records,
        successfulRecords: lastBatch.successful_records,
        failedRecords: lastBatch.failed_records,
        createdAt: lastBatch.created_at,
        completedAt: lastBatch.completed_at,
        lastHeartbeat: lastBatch.last_heartbeat,
        recentErrors: lastBatch.errors.map((err) => ({
          rowNumber: err.row_number,
          errorType: err.error_type,
          message: err.error_message,
          severity: err.severity,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "Error al obtener el estado de sincronización" },
      { status: 500 }
    );
  }
}
