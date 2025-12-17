-- Migration: Assign all existing AEDs to SAMUR Madrid
-- This migration creates SAMUR Madrid organization and assigns all existing AEDs to it

-- Create SAMUR Madrid organization (if not exists)
INSERT INTO "organizations" (
  "id",
  "type",
  "name",
  "code",
  "email",
  "phone",
  "scope_type",
  "city_code",
  "city_name",
  "district_codes",
  "require_approval",
  "approval_authority",
  "badge_name",
  "badge_icon",
  "badge_color",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  'CIVIL_PROTECTION',
  'SAMUR - Protección Civil Madrid',
  'SAMUR_MADRID',
  'samur@madrid.es',
  '112',
  'CITY',
  '28079',
  'Madrid',
  ARRAY[]::TEXT[],
  true,
  'Ayuntamiento de Madrid',
  'Verificado por SAMUR',
  '🚒',
  '#DC2626',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "organizations" WHERE "code" = 'SAMUR_MADRID'
);

-- Update all locations with Madrid city code (if not already set)
UPDATE "aed_locations"
SET
  "city_code" = '28079',
  "city_name" = 'Madrid'
WHERE "city_code" IS NULL;

-- Create assignments for all AEDs that don't have one yet
INSERT INTO "aed_organization_assignments" (
  "id",
  "aed_id",
  "organization_id",
  "assignment_type",
  "status",
  "publication_mode",
  "approved_for_full",
  "approved_by_authority",
  "approval_notes",
  "assigned_at"
)
SELECT
  gen_random_uuid(),
  a."id" as "aed_id",
  o."id" as "organization_id",
  'CIVIL_PROTECTION',
  'ACTIVE',
  CASE
    WHEN a."status" = 'PUBLISHED' THEN COALESCE(a."publication_mode", 'FULL')
    WHEN a."status" = 'PENDING_REVIEW' THEN 'LOCATION_ONLY'
    ELSE 'NONE'
  END,
  CASE WHEN a."status" = 'PUBLISHED' THEN true ELSE false END,
  CASE WHEN a."status" = 'PUBLISHED' THEN true ELSE false END,
  'Initial migration - existing AED assigned to SAMUR Madrid',
  CURRENT_TIMESTAMP
FROM "aeds" a
CROSS JOIN "organizations" o
WHERE o."code" = 'SAMUR_MADRID'
  AND NOT EXISTS (
    SELECT 1
    FROM "aed_organization_assignments" aoa
    WHERE aoa."aed_id" = a."id"
      AND aoa."status" = 'ACTIVE'
  );

-- Create verifications for all PUBLISHED AEDs
INSERT INTO "aed_organization_verifications" (
  "id",
  "aed_id",
  "organization_id",
  "verification_type",
  "verified_by",
  "verified_at",
  "verified_address",
  "verified_schedule",
  "verified_photos",
  "verified_access",
  "verified_signage",
  "is_current",
  "notes"
)
SELECT
  gen_random_uuid(),
  a."id" as "aed_id",
  o."id" as "organization_id",
  'INFORMAL',
  '00000000-0000-0000-0000-000000000000', -- Placeholder UUID for system
  CURRENT_TIMESTAMP,
  true,
  true,
  true,
  true,
  false,
  true,
  'Initial verification from migration - existing published AED'
FROM "aeds" a
CROSS JOIN "organizations" o
WHERE o."code" = 'SAMUR_MADRID'
  AND a."status" = 'PUBLISHED'
  AND NOT EXISTS (
    SELECT 1
    FROM "aed_organization_verifications" aov
    WHERE aov."aed_id" = a."id"
      AND aov."organization_id" = o."id"
  );

-- Summary of migration (output results)
DO $$
DECLARE
  org_count INT;
  assignment_count INT;
  verification_count INT;
BEGIN
  SELECT COUNT(*) INTO org_count FROM "organizations" WHERE "code" = 'SAMUR_MADRID';
  SELECT COUNT(*) INTO assignment_count FROM "aed_organization_assignments"
    WHERE "organization_id" = (SELECT "id" FROM "organizations" WHERE "code" = 'SAMUR_MADRID');
  SELECT COUNT(*) INTO verification_count FROM "aed_organization_verifications"
    WHERE "organization_id" = (SELECT "id" FROM "organizations" WHERE "code" = 'SAMUR_MADRID');

  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '  - SAMUR Madrid organizations: %', org_count;
  RAISE NOTICE '  - Total assignments: %', assignment_count;
  RAISE NOTICE '  - Total verifications: %', verification_count;
END $$;
