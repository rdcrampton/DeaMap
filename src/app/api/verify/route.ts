import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { getVerifiableAedsForUser } from "@/lib/organization-permissions";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const organizationId = searchParams.get("organization_id") || undefined;

    // Get AEDs based on user's role and organization memberships
    const { aeds, totalCount, userOrganizations } = await getVerifiableAedsForUser(
      user.userId,
      user.role,
      {
        page,
        limit,
        organization_id: organizationId,
        status: ["DRAFT", "PENDING_REVIEW"],
      }
    );

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: aeds,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      userOrganizations: userOrganizations.map((om) => ({
        id: om.organization.id,
        name: om.organization.name,
        type: om.organization.type,
        role: om.role,
        can_verify: om.can_verify,
      })),
      isAdmin: user.role === "ADMIN",
    });
  } catch (error) {
    console.error("Error fetching AEDs for verification:", error);
    return NextResponse.json({ error: "Error al cargar DEAs" }, { status: 500 });
  }
}
