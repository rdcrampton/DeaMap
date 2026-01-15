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

    // Obtener detalles de la organización
    const organization = await prisma.organization.findUnique({
      where: {
        id: orgId,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organización no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error fetching organization details:", error);
    return NextResponse.json(
      { error: "Error al obtener detalles de la organización" },
      { status: 500 }
    );
  }
}
