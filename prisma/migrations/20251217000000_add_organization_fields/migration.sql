-- Add missing fields to organizations table
ALTER TABLE "organizations" ADD COLUMN "website" TEXT;
ALTER TABLE "organizations" ADD COLUMN "description" TEXT;
ALTER TABLE "organizations" ADD COLUMN "custom_scope_description" TEXT;
ALTER TABLE "organizations" ADD COLUMN "created_by" UUID;
ALTER TABLE "organizations" ADD COLUMN "updated_by" UUID;
