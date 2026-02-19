/**
 * Admin API for managing users
 * Only users with ADMIN role can access these endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/admin/users
 * List all users (with optional filters)
 */
export async function GET(request: NextRequest) {
  // Verify admin permissions
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const isActive = searchParams.get("is_active");
    const isVerified = searchParams.get("is_verified");
    const search = searchParams.get("search"); // Search by email or name

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (role) where.role = role;
    if (isActive !== null && isActive !== undefined) where.is_active = isActive === "true";
    if (isVerified !== null && isVerified !== undefined) where.is_verified = isVerified === "true";

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Single query with nested include to avoid N+1 (was: 1 query per user)
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        is_verified: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
        organization_members: {
          select: {
            role: true,
            joined_at: true,
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
                code: true,
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Map to expected response shape
    const usersWithOrgs = users.map((user) => {
      const { organization_members, ...userData } = user;
      return {
        ...userData,
        organizations: organization_members.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          type: m.organization.type,
          code: m.organization.code,
          role: m.role,
          joined_at: m.joined_at,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: usersWithOrgs
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
