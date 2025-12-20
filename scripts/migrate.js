#!/usr/bin/env node

/**
 * Conditional Migration Script with Branch Database Support
 *
 * This script handles:
 * 1. Branch-specific database creation (when configured)
 * 2. Prisma migrations
 * 3. Dummy data seeding for new branch databases
 *
 * Branch Database Feature:
 * - Creates a separate database for each feature branch
 * - Populates new databases with 500 realistic dummy DEAs
 * - Only runs in Vercel with proper environment variables configured
 *
 * Required env vars for branch databases:
 * - POSTGRES_ADMIN_URL: Admin connection to create databases
 * - POSTGRES_HOST: Database host
 * - POSTGRES_PORT: Database port (default: 5432)
 * - POSTGRES_DB_USER: Application database user
 * - POSTGRES_DB_PASSWORD: Application database password
 */

const { execSync } = require("child_process");

// Import branch database utilities
const {
  shouldCreateBranchDatabase,
  createBranchDatabaseIfNeeded,
  getCurrentBranch,
  isFeatureEnabled,
} = require("./branch-database");

// Check if we're running in Vercel
const isVercel = process.env.VERCEL === "1";

// Get the current git branch
const gitBranch = getCurrentBranch();

// Define branches that should run migrations
const MIGRATION_BRANCHES = ["main", "refactor", "claude/simple-dea-form"];

// Also allow claude/ and copilot/ branches to run migrations for development previews
const isClaudeBranch = gitBranch.startsWith("claude/");
const isCopilotBranch = gitBranch.startsWith("copilot/");

// Check if current branch matches any migration branch or is a claude/copilot branch
const shouldRunMigrations =
  isVercel &&
  (MIGRATION_BRANCHES.some(
    (branch) => gitBranch === branch || gitBranch.includes(branch)
  ) ||
    isClaudeBranch ||
    isCopilotBranch);

async function main() {
  console.log("🔍 Migration Check:");
  console.log(`   - Running in Vercel: ${isVercel ? "✅" : "❌"}`);
  console.log(`   - Current branch: ${gitBranch || "unknown"}`);
  console.log(`   - Should run migrations: ${shouldRunMigrations ? "✅" : "❌"}`);
  console.log(
    `   - Branch DB feature: ${isFeatureEnabled() ? "✅ enabled" : "❌ disabled"}`
  );

  let isNewDatabase = false;

  // Branch database creation (if configured)
  if (shouldCreateBranchDatabase()) {
    console.log("\n📦 Branch Database Setup...\n");

    try {
      const result = await createBranchDatabaseIfNeeded();

      if (result.databaseUrl) {
        // Update DATABASE_URL for Prisma
        process.env.DATABASE_URL = result.databaseUrl;
        console.log(`   ✅ Using database: ${result.databaseName}`);
      }

      isNewDatabase = result.isNewDatabase;

      if (isNewDatabase) {
        console.log("   ℹ️  New database - will seed with dummy data after migrations");
      }
    } catch (error) {
      console.error("   ❌ Branch database setup failed:", error.message);
      console.log("   ⚠️  Falling back to DATABASE_URL");
      // Continue with default DATABASE_URL
    }
  }

  // Run migrations
  if (shouldRunMigrations) {
    console.log("\n🚀 Running Prisma migrations...\n");
    try {
      execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        env: process.env,
      });
      console.log("\n✅ Migrations completed successfully\n");
    } catch (error) {
      console.error("\n❌ Migration failed:", error.message);
      process.exit(1);
    }
  } else {
    console.log("\n⏭️  Skipping migrations (not in target branch on Vercel)\n");
  }

  // Always generate Prisma client
  console.log("📦 Generating Prisma client...\n");
  try {
    execSync("npx prisma generate", {
      stdio: "inherit",
      env: process.env,
    });
    console.log("\n✅ Prisma client generated\n");
  } catch (error) {
    console.error("\n❌ Prisma generate failed:", error.message);
    process.exit(1);
  }

  // Seed dummy data for new branch databases
  if (isNewDatabase && shouldRunMigrations) {
    console.log("🌱 Seeding dummy data for new branch database...\n");
    try {
      execSync("npx tsx prisma/seed-dummy.ts", {
        stdio: "inherit",
        env: process.env,
      });
      console.log("\n✅ Dummy data seeded successfully\n");
    } catch (error) {
      console.error("\n⚠️  Dummy data seed failed:", error.message);
      console.log("   This is non-fatal, continuing with empty database\n");
      // Don't exit - the database is still usable, just empty
    }
  }

  console.log("✨ Migration script completed\n");
}

// Run the async main function
main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
