-- Add missing fields to organizations table
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "custom_scope_description" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "created_by" UUID;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "updated_by" UUID;

-- Add missing fields to organization_members table
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "added_by" UUID;
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "updated_by" UUID;

-- Add foreign key for organization_members -> users (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_user_id_fkey'
    ) THEN
        ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
