-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('CSV_FILE', 'CKAN_API', 'JSON_FILE', 'REST_API');

-- CreateEnum
CREATE TYPE "MatchingStrategy" AS ENUM ('BY_EXTERNAL_CODE', 'BY_COORDINATES', 'BY_ADDRESS', 'HYBRID');

-- CreateEnum
CREATE TYPE "SyncFrequency" AS ENUM ('MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "external_data_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DataSourceType" NOT NULL,
    "config" JSONB NOT NULL,
    "matching_strategy" "MatchingStrategy" NOT NULL DEFAULT 'HYBRID',
    "matching_threshold" INTEGER NOT NULL DEFAULT 75,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sync_frequency" "SyncFrequency" NOT NULL DEFAULT 'MANUAL',
    "last_sync_at" TIMESTAMP(3),
    "next_scheduled_sync_at" TIMESTAMP(3),
    "auto_deactivate_missing" BOOLEAN NOT NULL DEFAULT false,
    "auto_update_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_origin" "SourceOrigin" NOT NULL,
    "region_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "external_data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_data_sources_name_key" ON "external_data_sources"("name");

-- CreateIndex
CREATE INDEX "external_data_sources_is_active_idx" ON "external_data_sources"("is_active");

-- CreateIndex
CREATE INDEX "external_data_sources_sync_frequency_idx" ON "external_data_sources"("sync_frequency");

-- CreateIndex
CREATE INDEX "external_data_sources_next_scheduled_sync_at_idx" ON "external_data_sources"("next_scheduled_sync_at");

-- CreateIndex
CREATE INDEX "external_data_sources_region_code_idx" ON "external_data_sources"("region_code");

-- Add data_source_id column to aeds table
ALTER TABLE "aeds" ADD COLUMN "data_source_id" UUID;
ALTER TABLE "aeds" ADD COLUMN "last_synced_at" TIMESTAMP(3);
ALTER TABLE "aeds" ADD COLUMN "sync_content_hash" TEXT;

-- Add data_source_id column to import_batches table
ALTER TABLE "import_batches" ADD COLUMN "data_source_id" UUID;

-- CreateIndex for aeds.data_source_id
CREATE INDEX "aeds_data_source_id_idx" ON "aeds"("data_source_id");

-- CreateIndex for import_batches.data_source_id
CREATE INDEX "import_batches_data_source_id_idx" ON "import_batches"("data_source_id");

-- AddForeignKey for aeds -> external_data_sources
ALTER TABLE "aeds" ADD CONSTRAINT "aeds_data_source_id_fkey"
    FOREIGN KEY ("data_source_id") REFERENCES "external_data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for import_batches -> external_data_sources
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_data_source_id_fkey"
    FOREIGN KEY ("data_source_id") REFERENCES "external_data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
