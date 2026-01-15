import { NextResponse } from "next/server";

import { verifyAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { orgId: string } }
) {
  try {
    const auth = await verifyAuth(request);

    if (!auth.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { orgId } = params;

    // Verificar que el usuario pertenece a la organización
    const membership = await prisma.organization_member.findFirst({
      where: {
        organization_id: orgId,
        user_id: auth.user.id,
      },
    });

    if (!membership && auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes acceso a esta organización" },
        { status: 403 }
      );
    }

    // Obtener DEAs asignados a la organización
    const assignments = await prisma.aed_organization_assignment.findMany({
      where: {
        organization_id: orgId,
        status: "ACTIVE",
      },
      include: {
        aed: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            is_active: true,
            last_verified_at: true,
            establishment_type: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Mapear a formato más simple
    const deas = assignments.map((assignment) => ({
      id: assignment.aed.id,
      name: assignment.aed.name,
      address: assignment.aed.address,
      city: assignment.aed.city,
      is_active: assignment.aed.is_active,
      last_verified_at: assignment.aed.last_verified_at,
      establishment_type: assignment.aed.establishment_type,
      assignment_type: assignment.assignment_type,
    }));

    return NextResponse.json({
      deas,
      total: deas.length,
    });
  } catch (error) {
    console.error("Error fetching organization DEAs:", error);
    return NextResponse.json(
      { error: "Error al obtener DEAs" },
      { status: 500 }
    );
  }
}
