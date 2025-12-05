/**
 * API Route para detalles de una exportación específica
 * GET /api/export/[id] - Obtener detalles de la exportación
 */

import { NextRequest, NextResponse } from "next/server";

import { PrismaExportRepository } from "@/infrastructure/export/repositories/PrismaExportRepository";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * GET /api/export/[id]
 * Obtener detalles de una exportación
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request);

    if (!user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!user.isVerified) {
      return NextResponse.json(
        { error: "Usuario no verificado" },
        { status: 403 }
      );
    }

    const { id } = context.params;

    const repository = new PrismaExportRepository(prisma);
    const batch = await repository.getBatchInfo(id);

    if (!batch) {
      return NextResponse.json(
        { error: "Exportación no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que el usuario sea el dueño de la exportación
    if (batch.exportedBy !== user.userId) {
      return NextResponse.json(
        { error: "No tienes permiso para ver esta exportación" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: batch,
    });
  } catch (error) {
    console.error("Get export details error:", error);
    return NextResponse.json(
      { error: "Error al obtener detalles de la exportación" },
      { status: 500 }
    );
  }
}
