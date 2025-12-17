/**
 * Admin API for running database migrations manually
 * Only users with ADMIN role can access this endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/migrate
 * Run pending database migrations manually
 */
export async function POST(request: NextRequest) {
  // Verify admin permissions
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Admin access required" },
      { status: 403 }
    );
  }

  try {
    // Run the specific migration to add missing organization fields
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "website" TEXT;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "description" TEXT;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "custom_scope_description" TEXT;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "created_by" UUID;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "updated_by" UUID;
    `);

    // Add missing fields to organization_members table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "notes" TEXT;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "added_by" UUID;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "updated_by" UUID;
    `);

    // Add foreign key for organization_members -> users (if not exists)
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_user_id_fkey'
          ) THEN
              ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey"
              FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
      END $$;
    `);

    return NextResponse.json({
      success: true,
      message: "Migrations executed successfully",
      columns_added: {
        organizations: [
          "website",
          "description",
          "custom_scope_description",
          "created_by",
          "updated_by"
        ],
        organization_members: [
          "notes",
          "added_by",
          "updated_by",
          "user_id_fkey (foreign key)"
        ]
      }
    });

  } catch (error) {
    console.error("Error running migrations:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run migrations",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate
 * Check migration status
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
    // Check if columns exist in organizations table
    const orgResult = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'organizations'
      AND column_name IN ('website', 'description', 'custom_scope_description', 'created_by', 'updated_by')
      ORDER BY column_name;
    `);

    // Check if columns exist in organization_members table
    const memberResult = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'organization_members'
      AND column_name IN ('notes', 'added_by', 'updated_by')
      ORDER BY column_name;
    `);

    // Check if foreign key exists
    const fkResult = await prisma.$queryRawUnsafe<Array<{ conname: string }>>(`
      SELECT conname
      FROM pg_constraint
      WHERE conname = 'organization_members_user_id_fkey';
    `);

    const existingOrgColumns = orgResult.map(row => row.column_name);
    const requiredOrgColumns = ['website', 'description', 'custom_scope_description', 'created_by', 'updated_by'];
    const missingOrgColumns = requiredOrgColumns.filter(col => !existingOrgColumns.includes(col));

    const existingMemberColumns = memberResult.map(row => row.column_name);
    const requiredMemberColumns = ['notes', 'added_by', 'updated_by'];
    const missingMemberColumns = requiredMemberColumns.filter(col => !existingMemberColumns.includes(col));

    const hasForeignKey = fkResult.length > 0;

    return NextResponse.json({
      success: true,
      organizations: {
        existing_columns: existingOrgColumns,
        missing_columns: missingOrgColumns
      },
      organization_members: {
        existing_columns: existingMemberColumns,
        missing_columns: missingMemberColumns,
        has_user_foreign_key: hasForeignKey
      },
      migration_needed: missingOrgColumns.length > 0 || missingMemberColumns.length > 0 || !hasForeignKey
    });

  } catch (error) {
    console.error("Error checking migration status:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check migration status",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
