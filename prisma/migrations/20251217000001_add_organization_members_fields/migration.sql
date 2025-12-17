-- Add missing fields to organization_members table
ALTER TABLE "organization_members" ADD COLUMN "notes" TEXT;
ALTER TABLE "organization_members" ADD COLUMN "added_by" UUID;
ALTER TABLE "organization_members" ADD COLUMN "updated_by" UUID;

-- Add foreign key for organization_members -> users
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
