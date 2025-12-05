-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "export_batches" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB,
    "file_name" TEXT,
    "file_url" TEXT,
    "file_size" INTEGER,
    "file_hash" TEXT,
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "successful_records" INTEGER NOT NULL DEFAULT 0,
    "failed_records" INTEGER NOT NULL DEFAULT 0,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "error_message" TEXT,
    "error_details" JSONB,
    "exported_by" UUID NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "export_batches_status_idx" ON "export_batches"("status");

-- CreateIndex
CREATE INDEX "export_batches_created_at_idx" ON "export_batches"("created_at");

-- CreateIndex
CREATE INDEX "export_batches_exported_by_idx" ON "export_batches"("exported_by");

-- CreateIndex
CREATE INDEX "export_batches_status_created_at_idx" ON "export_batches"("status", "created_at");
