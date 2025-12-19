-- CreateEnum
CREATE TYPE "BatchJobType" AS ENUM ('AED_CSV_IMPORT', 'AED_EXTERNAL_SYNC', 'AED_CSV_EXPORT', 'AED_JSON_EXPORT', 'BULK_AED_UPDATE', 'BULK_AED_DELETE', 'BULK_STATUS_CHANGE', 'BULK_VERIFICATION', 'DATA_CLEANUP', 'IMAGE_OPTIMIZATION', 'REPORT_GENERATION');

-- CreateEnum
CREATE TYPE "BatchJobStatus" AS ENUM ('PENDING', 'QUEUED', 'IN_PROGRESS', 'PAUSED', 'WAITING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED', 'INTERRUPTED', 'RESUMING');

-- CreateEnum
CREATE TYPE "BatchCheckpointStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BatchErrorSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('FILE', 'URL', 'DATA', 'REPORT');

-- CreateTable
CREATE TABLE "batch_jobs" (
    "id" UUID NOT NULL,
    "type" "BatchJobType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "BatchJobStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB NOT NULL,
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "processed_records" INTEGER NOT NULL DEFAULT 0,
    "successful_records" INTEGER NOT NULL DEFAULT 0,
    "failed_records" INTEGER NOT NULL DEFAULT 0,
    "skipped_records" INTEGER NOT NULL DEFAULT 0,
    "warning_records" INTEGER NOT NULL DEFAULT 0,
    "current_chunk" INTEGER NOT NULL DEFAULT 0,
    "total_chunks" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error_summary" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "last_heartbeat" TIMESTAMP(3),
    "last_checkpoint_index" INTEGER NOT NULL DEFAULT -1,
    "resume_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "organization_id" UUID,
    "parent_job_id" UUID,
    "data_source_id" UUID,
    "metadata" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_job_checkpoints" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "record_index" INTEGER NOT NULL,
    "record_reference" TEXT,
    "record_hash" TEXT,
    "status" "BatchCheckpointStatus" NOT NULL,
    "error_message" TEXT,
    "processing_time_ms" INTEGER,
    "record_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_job_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_job_errors" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "record_index" INTEGER,
    "record_reference" TEXT,
    "error_type" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "severity" "BatchErrorSeverity" NOT NULL,
    "row_data" JSONB,
    "correction_suggestion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_job_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_job_artifacts" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "file_url" TEXT,
    "file_hash" TEXT,
    "data" JSONB,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_job_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_jobs_status_idx" ON "batch_jobs"("status");

-- CreateIndex
CREATE INDEX "batch_jobs_type_idx" ON "batch_jobs"("type");

-- CreateIndex
CREATE INDEX "batch_jobs_created_by_idx" ON "batch_jobs"("created_by");

-- CreateIndex
CREATE INDEX "batch_jobs_organization_id_idx" ON "batch_jobs"("organization_id");

-- CreateIndex
CREATE INDEX "batch_jobs_created_at_idx" ON "batch_jobs"("created_at");

-- CreateIndex
CREATE INDEX "batch_jobs_status_last_heartbeat_idx" ON "batch_jobs"("status", "last_heartbeat");

-- CreateIndex
CREATE INDEX "batch_jobs_data_source_id_idx" ON "batch_jobs"("data_source_id");

-- CreateIndex
CREATE INDEX "batch_jobs_parent_job_id_idx" ON "batch_jobs"("parent_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_job_checkpoints_job_id_record_index_key" ON "batch_job_checkpoints"("job_id", "record_index");

-- CreateIndex
CREATE INDEX "batch_job_checkpoints_job_id_status_idx" ON "batch_job_checkpoints"("job_id", "status");

-- CreateIndex
CREATE INDEX "batch_job_checkpoints_record_hash_idx" ON "batch_job_checkpoints"("record_hash");

-- CreateIndex
CREATE INDEX "batch_job_errors_job_id_idx" ON "batch_job_errors"("job_id");

-- CreateIndex
CREATE INDEX "batch_job_errors_error_type_idx" ON "batch_job_errors"("error_type");

-- CreateIndex
CREATE INDEX "batch_job_errors_severity_idx" ON "batch_job_errors"("severity");

-- CreateIndex
CREATE INDEX "batch_job_artifacts_job_id_idx" ON "batch_job_artifacts"("job_id");

-- CreateIndex
CREATE INDEX "batch_job_artifacts_type_idx" ON "batch_job_artifacts"("type");

-- CreateIndex
CREATE INDEX "batch_job_artifacts_expires_at_idx" ON "batch_job_artifacts"("expires_at");

-- AddForeignKey
ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_parent_job_id_fkey" FOREIGN KEY ("parent_job_id") REFERENCES "batch_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "external_data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_job_checkpoints" ADD CONSTRAINT "batch_job_checkpoints_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "batch_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_job_errors" ADD CONSTRAINT "batch_job_errors_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "batch_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_job_artifacts" ADD CONSTRAINT "batch_job_artifacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "batch_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
