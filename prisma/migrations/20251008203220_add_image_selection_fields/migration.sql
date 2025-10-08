-- AlterTable
ALTER TABLE "verification_sessions" ADD COLUMN "image1_valid" BOOLEAN,
ADD COLUMN "image2_valid" BOOLEAN,
ADD COLUMN "images_swapped" BOOLEAN,
ADD COLUMN "marked_as_invalid" BOOLEAN NOT NULL DEFAULT false;
