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

    return NextResponse.json({
      success: true,
      message: "Migrations executed successfully",
      columns_added: [
        "website",
        "description",
        "custom_scope_description",
        "created_by",
        "updated_by"
      ]
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
    // Check if columns exist by querying the information schema
    const result = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'organizations'
      AND column_name IN ('website', 'description', 'custom_scope_description', 'created_by', 'updated_by')
      ORDER BY column_name;
    `);

    const existingColumns = result.map(row => row.column_name);
    const requiredColumns = ['website', 'description', 'custom_scope_description', 'created_by', 'updated_by'];
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    return NextResponse.json({
      success: true,
      existing_columns: existingColumns,
      missing_columns: missingColumns,
      migration_needed: missingColumns.length > 0
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
