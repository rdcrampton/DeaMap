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

    // Verificar si se debe continuar un batch existente
    const continueBatchId = body.continueBatchId as string | undefined;
    let existingBatchId: string | undefined;

    if (continueBatchId) {
      // Verificar que el batch existe y está en progreso
      const batchToResume = await prisma.importBatch.findUnique({
        where: { id: continueBatchId, data_source_id: id },
      });

      if (!batchToResume) {
        return NextResponse.json({ error: "Batch no encontrado" }, { status: 404 });
      }

      if (batchToResume.status !== "IN_PROGRESS") {
        return NextResponse.json({ error: "El batch no está en progreso" }, { status: 400 });
      }

      existingBatchId = continueBatchId;
    } else {
      // Si no se especifica batch, verificar que no hay otro en progreso
      const inProgressBatch = await prisma.importBatch.findFirst({
        where: {
          data_source_id: id,
          status: "IN_PROGRESS",
        },
      });

      if (inProgressBatch) {
        // Si hay un batch en progreso, continuarlo automáticamente
        existingBatchId = inProgressBatch.id;
        console.log(`🔄 Continuando batch existente: ${existingBatchId}`);
      }
    }

    // Configurar opciones de sincronización
    // Por defecto, procesar solo 100 registros por invocación para evitar timeouts
    const batchSize = body.batchSize ? parseInt(body.batchSize) : 100;

    const options = {
      dryRun: body.dryRun === true,
      forceFullSync: body.forceFullSync === true,
      maxRecords: batchSize,
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

    // Ejecutar sincronización (creará nuevo batch o continuará el existente)
    const result = await useCase.execute({
      dataSourceId: id,
      importedBy: user.userId,
      options: {
        ...options,
        existingBatchId, // Pasar el batch existente para continuar
      },
    });

    // Obtener información de progreso después de procesar este batch
    const batchInfo = await prisma.importBatch.findUnique({
      where: { id: result.batchId },
      select: {
        total_records: true,
        successful_records: true,
        failed_records: true,
        last_checkpoint_index: true,
        status: true,
      },
    });

    const totalRecords = batchInfo?.total_records || 0;
    const processedRecords = (batchInfo?.last_checkpoint_index ?? -1) + 1;
    const hasMore = batchInfo?.status === "IN_PROGRESS" && processedRecords < totalRecords;
    const progress = totalRecords > 0 ? Math.round((processedRecords / totalRecords) * 100) : 0;

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
        progress: {
          total: totalRecords,
          processed: processedRecords,
          percentage: progress,
          hasMore,
          status: batchInfo?.status || "UNKNOWN",
        },
      },
      message: hasMore
        ? `Batch procesado: ${processedRecords}/${totalRecords} registros (${progress}%)`
        : result.success
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
