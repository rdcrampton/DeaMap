-- Add owner_user_id to Aed model
ALTER TABLE "aeds" ADD COLUMN "owner_user_id" UUID;

-- Create index for owner_user_id
CREATE INDEX "aeds_owner_user_id_idx" ON "aeds"("owner_user_id");

-- CreateEnum for OrganizationType
CREATE TYPE "OrganizationType" AS ENUM ('CIVIL_PROTECTION', 'CERTIFIED_COMPANY', 'VOLUNTEER_GROUP', 'MUNICIPALITY', 'HEALTH_SERVICE', 'OWNER');

-- CreateEnum for OrgScopeType
CREATE TYPE "OrgScopeType" AS ENUM ('NATIONAL', 'REGIONAL', 'CITY', 'DISTRICT', 'CUSTOM');

-- CreateEnum for OrgMemberRole
CREATE TYPE "OrgMemberRole" AS ENUM ('OWNER', 'ADMIN', 'VERIFIER', 'MEMBER', 'VIEWER');

-- CreateEnum for AssignmentType
CREATE TYPE "AssignmentType" AS ENUM ('CIVIL_PROTECTION', 'CERTIFIED_COMPANY', 'OWNERSHIP', 'MAINTENANCE', 'VERIFICATION');

-- CreateEnum for AssignmentStatus
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'COMPLETED', 'PENDING_APPROVAL');

-- CreateEnum for VerificationType
CREATE TYPE "VerificationType" AS ENUM ('INFORMAL', 'OFFICIAL', 'SELF_REPORTED', 'FIELD_INSPECTION');

-- CreateEnum for ProposalChangeType
CREATE TYPE "ProposalChangeType" AS ENUM ('UPDATE_SCHEDULE', 'UPDATE_LOCATION', 'ADD_PHOTOS', 'UPDATE_ACCESS', 'REPORT_ISSUE');

-- CreateEnum for ProposalStatus
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO');

-- CreateEnum for ChangeSource
CREATE TYPE "ChangeSource" AS ENUM ('WEB_UI', 'API', 'IMPORT', 'VERIFICATION', 'PROPOSAL_APPROVAL');

-- CreateEnum for ClaimType
CREATE TYPE "ClaimType" AS ENUM ('ESTABLISHMENT_OWNER', 'EQUIPMENT_OWNER', 'AUTHORIZED_MANAGER');

-- CreateEnum for ClaimStatus
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_VERIFICATION');

-- CreateTable organizations
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "scope_type" "OrgScopeType" NOT NULL DEFAULT 'CITY',
    "city_code" TEXT,
    "city_name" TEXT,
    "district_codes" TEXT[],
    "require_approval" BOOLEAN NOT NULL DEFAULT true,
    "approval_authority" TEXT,
    "badge_name" TEXT,
    "badge_icon" TEXT,
    "badge_color" TEXT,
    "parent_org_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable organization_members
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'MEMBER',
    "can_verify" BOOLEAN NOT NULL DEFAULT true,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_approve" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_members" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable aed_organization_assignments
CREATE TABLE "aed_organization_assignments" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "assignment_type" "AssignmentType" NOT NULL DEFAULT 'VERIFICATION',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "publication_mode" "PublicationMode" NOT NULL DEFAULT 'LOCATION_ONLY',
    "approved_for_full" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_authority" BOOLEAN NOT NULL DEFAULT false,
    "approval_notes" TEXT,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by" UUID,
    "revoked_reason" TEXT,

    CONSTRAINT "aed_organization_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable aed_organization_verifications
CREATE TABLE "aed_organization_verifications" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "verification_type" "VerificationType" NOT NULL,
    "verified_by" UUID NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_address" BOOLEAN NOT NULL DEFAULT false,
    "verified_schedule" BOOLEAN NOT NULL DEFAULT false,
    "verified_photos" BOOLEAN NOT NULL DEFAULT false,
    "verified_access" BOOLEAN NOT NULL DEFAULT false,
    "verified_signage" BOOLEAN NOT NULL DEFAULT false,
    "certificate_number" TEXT,
    "certificate_expiry" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "superseded_by" UUID,
    "superseded_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "aed_organization_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable aed_change_proposals
CREATE TABLE "aed_change_proposals" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "proposed_by" UUID NOT NULL,
    "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_type" "ProposalChangeType" NOT NULL,
    "proposed_changes" JSONB NOT NULL,
    "attached_images" TEXT[],
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,

    CONSTRAINT "aed_change_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable aed_field_changes
CREATE TABLE "aed_field_changes" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" UUID NOT NULL,
    "changed_by_org" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_source" "ChangeSource" NOT NULL,

    CONSTRAINT "aed_field_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable aed_ownership_claims
CREATE TABLE "aed_ownership_claims" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "claimed_by" UUID NOT NULL,
    "claimed_by_org" UUID,
    "claim_type" "ClaimType" NOT NULL,
    "evidence_description" TEXT NOT NULL,
    "evidence_files" TEXT[],
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aed_ownership_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "organizations_city_code_idx" ON "organizations"("city_code");

-- CreateIndex
CREATE INDEX "organizations_scope_type_idx" ON "organizations"("scope_type");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organizations_is_active_idx" ON "organizations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_assignment_per_type" ON "aed_organization_assignments"("aed_id", "assignment_type", "status");

-- CreateIndex
CREATE INDEX "aed_organization_assignments_aed_id_status_idx" ON "aed_organization_assignments"("aed_id", "status");

-- CreateIndex
CREATE INDEX "aed_organization_assignments_organization_id_status_idx" ON "aed_organization_assignments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "aed_organization_assignments_assignment_type_idx" ON "aed_organization_assignments"("assignment_type");

-- CreateIndex
CREATE INDEX "aed_organization_verifications_aed_id_is_current_idx" ON "aed_organization_verifications"("aed_id", "is_current");

-- CreateIndex
CREATE INDEX "aed_organization_verifications_organization_id_verified_at_idx" ON "aed_organization_verifications"("organization_id", "verified_at");

-- CreateIndex
CREATE INDEX "aed_organization_verifications_is_current_idx" ON "aed_organization_verifications"("is_current");

-- CreateIndex
CREATE INDEX "aed_change_proposals_aed_id_status_idx" ON "aed_change_proposals"("aed_id", "status");

-- CreateIndex
CREATE INDEX "aed_change_proposals_proposed_by_status_idx" ON "aed_change_proposals"("proposed_by", "status");

-- CreateIndex
CREATE INDEX "aed_change_proposals_status_idx" ON "aed_change_proposals"("status");

-- CreateIndex
CREATE INDEX "aed_field_changes_aed_id_changed_at_idx" ON "aed_field_changes"("aed_id", "changed_at");

-- CreateIndex
CREATE INDEX "aed_field_changes_field_name_idx" ON "aed_field_changes"("field_name");

-- CreateIndex
CREATE INDEX "aed_field_changes_changed_by_idx" ON "aed_field_changes"("changed_by");

-- CreateIndex
CREATE INDEX "aed_ownership_claims_aed_id_status_idx" ON "aed_ownership_claims"("aed_id", "status");

-- CreateIndex
CREATE INDEX "aed_ownership_claims_claimed_by_idx" ON "aed_ownership_claims"("claimed_by");

-- CreateIndex
CREATE INDEX "aed_ownership_claims_status_idx" ON "aed_ownership_claims"("status");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_org_id_fkey" FOREIGN KEY ("parent_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_organization_assignments" ADD CONSTRAINT "aed_organization_assignments_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_organization_assignments" ADD CONSTRAINT "aed_organization_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_organization_verifications" ADD CONSTRAINT "aed_organization_verifications_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_organization_verifications" ADD CONSTRAINT "aed_organization_verifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_change_proposals" ADD CONSTRAINT "aed_change_proposals_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_field_changes" ADD CONSTRAINT "aed_field_changes_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_ownership_claims" ADD CONSTRAINT "aed_ownership_claims_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
