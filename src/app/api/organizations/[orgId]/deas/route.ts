import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { orgId } = await params;

    // Verificar que el usuario pertenece a la organización
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organization_id: orgId,
        user_id: user.userId,
      },
    });

    if (!membership && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes acceso a esta organización" },
        { status: 403 }
      );
    }

    // Obtener DEAs asignados a la organización
    const assignments = await prisma.aedOrganizationAssignment.findMany({
      where: {
        organization_id: orgId,
        status: "ACTIVE",
      },
      include: {
        aed: {
          select: {
            id: true,
            name: true,
            status: true,
            last_verified_at: true,
            establishment_type: true,
            location: {
              select: {
                street_type: true,
                street_name: true,
                street_number: true,
                postal_code: true,
                city_name: true,
                district_name: true,
              },
            },
          },
        },
      },
      orderBy: {
        assigned_at: "desc",
      },
    });

    // Mapear a formato más simple
    const deas = assignments.map((assignment) => {
      const loc = assignment.aed.location;
      const addressParts = [
        loc?.street_type,
        loc?.street_name,
        loc?.street_number,
      ].filter(Boolean);

      return {
        id: assignment.aed.id,
        name: assignment.aed.name,
        address: addressParts.join(" ") || null,
        city: loc?.city_name || null,
        district: loc?.district_name || null,
        postal_code: loc?.postal_code || null,
        status: assignment.aed.status,
        last_verified_at: assignment.aed.last_verified_at,
        establishment_type: assignment.aed.establishment_type,
        assignment_type: assignment.assignment_type,
      };
    });

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
