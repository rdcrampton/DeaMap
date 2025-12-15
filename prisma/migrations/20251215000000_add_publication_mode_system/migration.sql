-- CreateEnum
CREATE TYPE "PublicationMode" AS ENUM ('NONE', 'LOCATION_ONLY', 'BASIC_INFO', 'FULL');

-- AlterTable
ALTER TABLE "aeds" ADD COLUMN "publication_mode" "PublicationMode" NOT NULL DEFAULT 'LOCATION_ONLY',
ADD COLUMN "publication_requested_at" TIMESTAMP(3),
ADD COLUMN "publication_approved_at" TIMESTAMP(3),
ADD COLUMN "publication_approved_by" UUID,
ADD COLUMN "publication_notes" TEXT;

-- CreateTable
CREATE TABLE "aed_publication_history" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "previous_mode" "PublicationMode",
    "new_mode" "PublicationMode" NOT NULL,
    "changed_by" UUID,
    "changed_by_role" TEXT,
    "change_reason" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "approval_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aed_publication_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_aeds_status_publication" ON "aeds"("status", "publication_mode");

-- CreateIndex
CREATE INDEX "aed_publication_history_aed_id_created_at_idx" ON "aed_publication_history"("aed_id", "created_at");

-- CreateIndex
CREATE INDEX "aed_publication_history_new_mode_idx" ON "aed_publication_history"("new_mode");

-- CreateIndex
CREATE INDEX "aed_publication_history_changed_by_idx" ON "aed_publication_history"("changed_by");

-- AddForeignKey
ALTER TABLE "aed_publication_history" ADD CONSTRAINT "aed_publication_history_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
