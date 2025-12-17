/**
 * Admin API for managing AED assignments to organizations
 * Only users with ADMIN role can access these endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/organizations/[id]/assignments
 * Get all AED assignments for an organization with pagination and filtering
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Admin access required" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);

  // Pagination params
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
  const skip = (page - 1) * limit;

  // Filter params
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const assignmentType = searchParams.get("assignment_type") || "";
  const aedStatus = searchParams.get("aed_status") || "";

  try {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Build where clause with filters
    const whereClause: any = { organization_id: id };

    if (status) {
      whereClause.status = status;
    }

    if (assignmentType) {
      whereClause.assignment_type = assignmentType;
    }

    // Search and AED status filters require nested conditions
    if (search || aedStatus) {
      whereClause.aed = {};

      if (search) {
        whereClause.aed.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { location: { city_name: { contains: search, mode: "insensitive" } } },
          { location: { street_name: { contains: search, mode: "insensitive" } } },
        ];
      }

      if (aedStatus) {
        whereClause.aed.status = aedStatus;
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.aedOrganizationAssignment.count({
      where: whereClause,
    });

    const assignments = await prisma.aedOrganizationAssignment.findMany({
      where: whereClause,
      include: {
        aed: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            location: {
              select: {
                street_name: true,
                street_number: true,
                city_name: true,
              },
            },
          },
        },
      },
      orderBy: { assigned_at: "desc" },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      data: {
        organization_id: id,
        assignments,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch assignments",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/organizations/[id]/assignments
 * Create a new AED assignment for an organization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Admin access required" },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      aed_id,
      assignment_type = "VERIFICATION",
      publication_mode = "LOCATION_ONLY",
      approved_for_full = false,
      approved_by_authority = false,
      approval_notes,
    } = body;

    // Validate required fields
    if (!aed_id) {
      return NextResponse.json(
        { success: false, error: "aed_id is required" },
        { status: 400 }
      );
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if AED exists
    const aed = await prisma.aed.findUnique({
      where: { id: aed_id },
    });

    if (!aed) {
      return NextResponse.json(
        { success: false, error: "AED not found" },
        { status: 404 }
      );
    }

    // Check for existing active assignment of the same type for this AED
    // Only one active CIVIL_PROTECTION or OWNERSHIP assignment per AED
    if (assignment_type === "CIVIL_PROTECTION" || assignment_type === "OWNERSHIP") {
      const existingAssignment = await prisma.aedOrganizationAssignment.findFirst({
        where: {
          aed_id,
          assignment_type,
          status: "ACTIVE",
        },
        include: {
          organization: {
            select: { name: true },
          },
        },
      });

      if (existingAssignment && existingAssignment.organization_id !== id) {
        return NextResponse.json(
          {
            success: false,
            error: `Este DEA ya tiene una asignación activa de tipo ${assignment_type} con ${existingAssignment.organization.name}`,
          },
          { status: 409 }
        );
      }
    }

    // Check if this organization already has an active assignment for this AED with same type
    const existingOrgAssignment = await prisma.aedOrganizationAssignment.findFirst({
      where: {
        aed_id,
        organization_id: id,
        assignment_type,
        status: "ACTIVE",
      },
    });

    if (existingOrgAssignment) {
      return NextResponse.json(
        {
          success: false,
          error: "Esta organización ya tiene una asignación activa de este tipo para este DEA",
        },
        { status: 409 }
      );
    }

    // Create the assignment
    const assignment = await prisma.aedOrganizationAssignment.create({
      data: {
        aed_id,
        organization_id: id,
        assignment_type,
        status: "ACTIVE",
        publication_mode,
        approved_for_full,
        approved_by_authority,
        approval_notes,
        assigned_by: admin.userId,
        assigned_at: new Date(),
      },
      include: {
        aed: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: assignment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating assignment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create assignment",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
