/**
 * Unified DEAs API
 * Flexible endpoint that handles multiple use cases with permission-based filtering
 *
 * Use cases:
 * - Public org view: /api/deas?organization_id=xxx
 * - Admin org view: /api/deas?organization_id=xxx (with admin permissions)
 * - Admin global view: /api/deas (all DEAs, no org filter)
 * - User org view: /api/deas (only their organizations)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ApiResponse, PaginationInfo } from "@/types/data-list.types";
import type { DeaListItem } from "@/types/dea-list.types";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse filters
    const organizationId = searchParams.get("organization_id") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
    const skip = (page - 1) * limit;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;  // Assignment status
    const aedStatus = searchParams.get("aed_status") || undefined;
    const assignmentType = searchParams.get("assignment_type") || undefined;

    // Check permissions and build where clause
    const isAdmin = user.role === "ADMIN";
    let allowedOrgIds: string[] = [];

    if (!isAdmin) {
      // Non-admin users: get their organizations
      const userOrgs = await prisma.organizationMember.findMany({
        where: { user_id: user.userId },
        select: { organization_id: true },
      });

      if (userOrgs.length === 0) {
        // User has no organizations = no access
        return NextResponse.json<ApiResponse<DeaListItem>>({
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            totalCount: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          permissions: {
            canView: false,
            canEdit: false,
            canDelete: false,
            canCreate: false,
          },
        });
      }

      allowedOrgIds = userOrgs.map((o) => o.organization_id);

      // If organization_id is specified, check if user has access
      if (organizationId && !allowedOrgIds.includes(organizationId)) {
        return NextResponse.json(
          { success: false, error: "No tienes acceso a esta organización" },
          { status: 403 }
        );
      }
    }

    // Build where clause for assignments
    const whereClause: any = {};

    // Organization filter
    if (organizationId) {
      whereClause.organization_id = organizationId;
    } else if (!isAdmin) {
      // Non-admin without specific org: filter by their organizations
      whereClause.organization_id = { in: allowedOrgIds };
    }
    // Admin without org filter: no restriction

    // Assignment status filter
    if (status === "active") {
      whereClause.status = "ACTIVE";
    } else if (status === "inactive") {
      whereClause.status = { not: "ACTIVE" };
    }

    // Assignment type filter
    if (assignmentType) {
      whereClause.assignment_type = assignmentType;
    }

    // AED-related filters (nested)
    if (search || aedStatus) {
      whereClause.aed = {};

      if (search) {
        whereClause.aed.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          {
            location: {
              OR: [
                { city_name: { contains: search, mode: "insensitive" } },
                { street_name: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ];
      }

      if (aedStatus) {
        whereClause.aed.status = aedStatus;
      }
    }

    // Get total count
    const totalCount = await prisma.aedOrganizationAssignment.count({
      where: whereClause,
    });

    // Get assignments with AED data
    const assignments = await prisma.aedOrganizationAssignment.findMany({
      where: whereClause,
      include: {
        aed: {
          select: {
            id: true,
            code: true,
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
                geocoding_validation: true,
              },
            },
          },
        },
      },
      orderBy: { assigned_at: "desc" },
      skip,
      take: limit,
    });

    // Map to DeaListItem format
    const deas: DeaListItem[] = assignments.map((assignment) => {
      const loc = assignment.aed.location;
      const addressParts = [
        loc?.street_type,
        loc?.street_name,
        loc?.street_number,
      ].filter(Boolean);

      // Extract coordinate validation data if present
      const geoValidation = loc?.geocoding_validation as { status?: string; distance_meters?: number } | null;

      return {
        id: assignment.aed.id,
        name: assignment.aed.name,
        code: assignment.aed.code,
        address: addressParts.join(" ") || "Sin dirección",
        city: loc?.city_name || null,
        district: loc?.district_name || null,
        postal_code: loc?.postal_code || null,
        status: assignment.aed.status,
        last_verified_at: assignment.aed.last_verified_at,
        establishment_type: assignment.aed.establishment_type,
        assignment_type: assignment.assignment_type,
        assignment_status: assignment.status,
        assigned_at: assignment.assigned_at,
        coordinate_validation: geoValidation?.status || null,
        coordinate_distance: geoValidation?.distance_meters || null,
      };
    });

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const pagination: PaginationInfo = {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    // Determine permissions
    const canManage = isAdmin || (organizationId ? allowedOrgIds.includes(organizationId) : false);
    const permissions = {
      canView: true,
      canEdit: Boolean(canManage),
      canDelete: Boolean(isAdmin),
      canCreate: Boolean(canManage),
      isAdmin: Boolean(isAdmin),
    };

    return NextResponse.json<ApiResponse<DeaListItem>>({
      success: true,
      data: deas,
      pagination,
      permissions,
    });
  } catch (error) {
    console.error("Error fetching DEAs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener DEAs",
        data: [],
      },
      { status: 500 }
    );
  }
}
