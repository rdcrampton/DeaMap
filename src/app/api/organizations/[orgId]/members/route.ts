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

    // Verificar que el usuario pertenece a la organización y tiene permisos para ver miembros
    const membership = await prisma.organization_member.findFirst({
      where: {
        organization_id: orgId,
        user_id: auth.user.id,
      },
    });

    // Solo ADMIN global o miembros con can_manage_members pueden ver la lista de miembros
    if (
      !membership?.can_manage_members &&
      auth.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "No tienes permisos para ver los miembros" },
        { status: 403 }
      );
    }

    // Obtener miembros de la organización
    const members = await prisma.organization_member.findMany({
      where: {
        organization_id: orgId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            is_active: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // OWNER primero, luego ADMIN, etc.
        { joined_at: "asc" },
      ],
    });

    return NextResponse.json({
      members,
      total: members.length,
    });
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json(
      { error: "Error al obtener miembros" },
      { status: 500 }
    );
  }
}
