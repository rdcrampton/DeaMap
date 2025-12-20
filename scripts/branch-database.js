#!/usr/bin/env node

/**
 * Branch Database Manager
 *
 * Creates and manages separate PostgreSQL databases for each git branch.
 * This allows isolated development environments with dummy data.
 *
 * Required environment variables:
 * - POSTGRES_ADMIN_URL: Admin connection to create databases
 * - POSTGRES_HOST: Database host
 * - POSTGRES_PORT: Database port (default: 5432)
 * - POSTGRES_DB_USER: Application database user
 * - POSTGRES_DB_PASSWORD: Application database password
 * - PRODUCTION_DATABASE_NAME: Base name for databases (default: samur_dea)
 */

const { Client } = require("pg");

// Configuration
const CONFIG = {
  // Branches that should use the main production database
  productionBranches: ["main", "master"],

  // Prefix for branch databases
  dbPrefix: process.env.PRODUCTION_DATABASE_NAME || "samur_dea",

  // Max database name length in PostgreSQL
  maxDbNameLength: 63,
};

/**
 * Sanitizes a branch name to be a valid PostgreSQL database name
 * PostgreSQL identifiers: lowercase, alphanumeric + underscore, max 63 chars
 */
function sanitizeBranchName(branch) {
  if (!branch) return null;

  const sanitized = branch
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_") // Replace non-alphanumeric with underscore
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_|_$/g, ""); // Remove leading/trailing underscores

  // Truncate to fit within max length (leaving room for prefix)
  const maxSuffixLength = CONFIG.maxDbNameLength - CONFIG.dbPrefix.length - 1;
  return sanitized.substring(0, maxSuffixLength);
}

/**
 * Generates the database name for a given branch
 */
function getDatabaseName(branch) {
  if (!branch || CONFIG.productionBranches.includes(branch)) {
    return CONFIG.dbPrefix;
  }

  const sanitized = sanitizeBranchName(branch);
  if (!sanitized) {
    return CONFIG.dbPrefix;
  }

  return `${CONFIG.dbPrefix}_${sanitized}`;
}

/**
 * Checks if branch database feature is enabled
 */
function isFeatureEnabled() {
  return !!(
    process.env.POSTGRES_ADMIN_URL &&
    process.env.POSTGRES_HOST &&
    process.env.POSTGRES_DB_USER &&
    process.env.POSTGRES_DB_PASSWORD
  );
}

/**
 * Gets the current git branch from environment
 */
function getCurrentBranch() {
  return process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || "";
}

/**
 * Determines if we should create a branch-specific database
 */
function shouldCreateBranchDatabase() {
  const branch = getCurrentBranch();
  const isVercel = process.env.VERCEL === "1";

  // Only in Vercel environment
  if (!isVercel) return false;

  // Feature must be enabled
  if (!isFeatureEnabled()) return false;

  // Don't create for production branches
  if (CONFIG.productionBranches.includes(branch)) return false;

  // Must have a valid branch name
  if (!branch) return false;

  return true;
}

/**
 * Checks if a database exists
 */
async function databaseExists(adminClient, dbName) {
  const result = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName]
  );
  return result.rows.length > 0;
}

/**
 * Creates a new database
 */
async function createDatabase(adminClient, dbName) {
  // Database names with special chars need quoting
  const safeName = dbName.replace(/"/g, '""');
  await adminClient.query(`CREATE DATABASE "${safeName}"`);
}

/**
 * Builds the DATABASE_URL for the application
 */
function buildDatabaseUrl(dbName) {
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || "5432";
  const user = process.env.POSTGRES_DB_USER;
  const password = process.env.POSTGRES_DB_PASSWORD;

  // URL encode the password in case it has special characters
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${dbName}`;
}

/**
 * Main function: Creates branch database if needed
 * Returns { isNewDatabase: boolean, databaseUrl: string, databaseName: string }
 */
async function createBranchDatabaseIfNeeded() {
  const branch = getCurrentBranch();
  const dbName = getDatabaseName(branch);

  console.log(`🔍 Branch Database Check:`);
  console.log(`   - Branch: ${branch}`);
  console.log(`   - Target database: ${dbName}`);

  // If feature not enabled, return the default DATABASE_URL
  if (!isFeatureEnabled()) {
    console.log(`   - Feature not enabled, using DATABASE_URL`);
    return {
      isNewDatabase: false,
      databaseUrl: process.env.DATABASE_URL,
      databaseName: null,
    };
  }

  // If production branch, use default DATABASE_URL
  if (CONFIG.productionBranches.includes(branch)) {
    console.log(`   - Production branch, using DATABASE_URL`);
    return {
      isNewDatabase: false,
      databaseUrl: process.env.DATABASE_URL,
      databaseName: dbName,
    };
  }

  // Connect to PostgreSQL as admin
  const adminClient = new Client({
    connectionString: process.env.POSTGRES_ADMIN_URL,
  });

  try {
    await adminClient.connect();

    // Check if database exists
    const exists = await databaseExists(adminClient, dbName);

    if (exists) {
      console.log(`   ✅ Database exists, reusing it`);
      return {
        isNewDatabase: false,
        databaseUrl: buildDatabaseUrl(dbName),
        databaseName: dbName,
      };
    }

    // Create new database
    console.log(`   📦 Creating new database...`);
    await createDatabase(adminClient, dbName);
    console.log(`   ✅ Database created: ${dbName}`);

    return {
      isNewDatabase: true,
      databaseUrl: buildDatabaseUrl(dbName),
      databaseName: dbName,
    };
  } finally {
    await adminClient.end();
  }
}

/**
 * Lists all branch databases (for cleanup purposes)
 */
async function listBranchDatabases() {
  if (!process.env.POSTGRES_ADMIN_URL) {
    throw new Error("POSTGRES_ADMIN_URL is required");
  }

  const adminClient = new Client({
    connectionString: process.env.POSTGRES_ADMIN_URL,
  });

  try {
    await adminClient.connect();

    const result = await adminClient.query(
      `SELECT datname FROM pg_database
       WHERE datname LIKE $1
       AND datname != $2
       ORDER BY datname`,
      [`${CONFIG.dbPrefix}_%`, CONFIG.dbPrefix]
    );

    return result.rows.map((row) => row.datname);
  } finally {
    await adminClient.end();
  }
}

/**
 * Drops a branch database (use with caution!)
 */
async function dropBranchDatabase(dbName) {
  if (!process.env.POSTGRES_ADMIN_URL) {
    throw new Error("POSTGRES_ADMIN_URL is required");
  }

  // Safety check: don't drop production database
  if (dbName === CONFIG.dbPrefix) {
    throw new Error("Cannot drop production database");
  }

  // Safety check: must start with prefix
  if (!dbName.startsWith(`${CONFIG.dbPrefix}_`)) {
    throw new Error(`Invalid database name: ${dbName}`);
  }

  const adminClient = new Client({
    connectionString: process.env.POSTGRES_ADMIN_URL,
  });

  try {
    await adminClient.connect();

    // Terminate existing connections
    await adminClient.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );

    // Drop database
    const safeName = dbName.replace(/"/g, '""');
    await adminClient.query(`DROP DATABASE IF EXISTS "${safeName}"`);

    console.log(`✅ Dropped database: ${dbName}`);
  } finally {
    await adminClient.end();
  }
}

// Export functions for use in migrate.js
module.exports = {
  sanitizeBranchName,
  getDatabaseName,
  isFeatureEnabled,
  getCurrentBranch,
  shouldCreateBranchDatabase,
  createBranchDatabaseIfNeeded,
  buildDatabaseUrl,
  listBranchDatabases,
  dropBranchDatabase,
};

// CLI interface when run directly
if (require.main === module) {
  const command = process.argv[2];

  async function main() {
    switch (command) {
      case "check":
        console.log("Feature enabled:", isFeatureEnabled());
        console.log("Current branch:", getCurrentBranch());
        console.log("Database name:", getDatabaseName(getCurrentBranch()));
        console.log("Should create:", shouldCreateBranchDatabase());
        break;

      case "create":
        const result = await createBranchDatabaseIfNeeded();
        console.log("Result:", JSON.stringify(result, null, 2));
        break;

      case "list":
        const databases = await listBranchDatabases();
        console.log("Branch databases:");
        databases.forEach((db) => console.log(`  - ${db}`));
        break;

      case "drop":
        const dbToDrop = process.argv[3];
        if (!dbToDrop) {
          console.error("Usage: branch-database.js drop <database-name>");
          process.exit(1);
        }
        await dropBranchDatabase(dbToDrop);
        break;

      default:
        console.log(`
Branch Database Manager

Usage:
  node branch-database.js check   - Check current configuration
  node branch-database.js create  - Create database for current branch
  node branch-database.js list    - List all branch databases
  node branch-database.js drop <name> - Drop a branch database

Environment variables required:
  POSTGRES_ADMIN_URL      - Admin connection string
  POSTGRES_HOST           - Database host
  POSTGRES_PORT           - Database port (default: 5432)
  POSTGRES_DB_USER        - Application user
  POSTGRES_DB_PASSWORD    - Application password
  PRODUCTION_DATABASE_NAME - Base database name (default: samur_dea)
`);
    }
  }

  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
