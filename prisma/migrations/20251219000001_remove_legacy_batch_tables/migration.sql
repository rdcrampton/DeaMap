-- Remove legacy batch tables
-- These tables are replaced by the BatchJob system

-- First, remove foreign key constraints from aeds table
ALTER TABLE "aeds" DROP CONSTRAINT IF EXISTS "aeds_import_batch_id_fkey";

-- Rename column in aeds to match new system
ALTER TABLE "aeds" RENAME COLUMN "import_batch_id" TO "batch_job_id";

-- Add new foreign key constraint
ALTER TABLE "aeds" ADD CONSTRAINT "aeds_batch_job_id_fkey"
  FOREIGN KEY ("batch_job_id") REFERENCES "batch_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update index name
DROP INDEX IF EXISTS "aeds_import_batch_id_idx";
CREATE INDEX "aeds_batch_job_id_idx" ON "aeds"("batch_job_id");

-- Drop legacy tables in correct order (children first)
DROP TABLE IF EXISTS "import_checkpoints" CASCADE;
DROP TABLE IF EXISTS "import_errors" CASCADE;
DROP TABLE IF EXISTS "import_batches" CASCADE;
DROP TABLE IF EXISTS "export_batches" CASCADE;

-- Drop legacy enums
DROP TYPE IF EXISTS "ImportStatus" CASCADE;
DROP TYPE IF EXISTS "ImportErrorType" CASCADE;
DROP TYPE IF EXISTS "ErrorSeverity" CASCADE;
DROP TYPE IF EXISTS "CheckpointStatus" CASCADE;
DROP TYPE IF EXISTS "ExportStatus" CASCADE;
