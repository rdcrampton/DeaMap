-- Add missing columns to external_data_sources table

-- Sync statistics columns
ALTER TABLE "external_data_sources"
ADD COLUMN IF NOT EXISTS "total_records_sync" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "records_created" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "records_updated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "records_skipped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "records_deactivated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_sync_duration_ms" INTEGER,
ADD COLUMN IF NOT EXISTS "last_sync_error" TEXT;

-- Default values for new AEDs
ALTER TABLE "external_data_sources"
ADD COLUMN IF NOT EXISTS "default_status" TEXT NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN IF NOT EXISTS "default_requires_attention" BOOLEAN NOT NULL DEFAULT true;
