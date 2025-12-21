-- Schema Simplification v2
-- This migration consolidates redundant fields and removes deprecated columns
-- IMPORTANT: Data is preserved by copying to new fields before deletion

-- ============================================
-- PHASE 1: ADD NEW COLUMNS
-- ============================================

-- Add location_details to aed_locations (if not exists)
ALTER TABLE "aed_locations" ADD COLUMN IF NOT EXISTS "location_details" TEXT;

-- Add notes to aed_schedules (if not exists)
ALTER TABLE "aed_schedules" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Add notes (JSONB) to aed_responsibles (if not exists)
ALTER TABLE "aed_responsibles" ADD COLUMN IF NOT EXISTS "notes" JSONB;

-- Add temporary JSONB column for internal_notes migration
ALTER TABLE "aeds" ADD COLUMN IF NOT EXISTS "internal_notes_new" JSONB;

-- ============================================
-- PHASE 2: MIGRATE DATA (PRESERVE EXISTING INFO)
-- ============================================

-- 2.1 AEDS TABLE: Consolidate notes into internal_notes_new (JSON format)
-- Convert existing internal_notes (TEXT) to JSON array and merge with other note fields
UPDATE "aeds" SET
  internal_notes_new = jsonb_build_array(
    jsonb_strip_nulls(jsonb_build_object(
      'text', CONCAT_WS(E'\n\n',
        CASE WHEN internal_notes IS NOT NULL AND internal_notes != '' THEN internal_notes END,
        CASE WHEN origin_observations IS NOT NULL AND origin_observations != ''
             THEN CONCAT('[Origen] ', origin_observations) END,
        CASE WHEN validation_notes IS NOT NULL AND validation_notes != ''
             THEN CONCAT('[Validación] ', validation_notes) END,
        CASE WHEN validation_observations IS NOT NULL AND validation_observations != ''
             THEN CONCAT('[Obs. Validación] ', validation_observations) END,
        CASE WHEN attention_reason IS NOT NULL AND attention_reason != ''
             THEN CONCAT('[Atención] ', attention_reason) END,
        CASE WHEN publication_notes IS NOT NULL AND publication_notes != ''
             THEN CONCAT('[Publicación] ', publication_notes) END
      ),
      'migrated_at', NOW()::TEXT,
      'type', 'migration_consolidation'
    ))
  )
WHERE internal_notes IS NOT NULL
   OR origin_observations IS NOT NULL
   OR validation_notes IS NOT NULL
   OR validation_observations IS NOT NULL
   OR attention_reason IS NOT NULL
   OR publication_notes IS NOT NULL;

-- Drop the old TEXT column and rename the new JSONB column
ALTER TABLE "aeds" DROP COLUMN IF EXISTS "internal_notes";
ALTER TABLE "aeds" RENAME COLUMN "internal_notes_new" TO "internal_notes";

-- 2.2 AED_LOCATIONS TABLE: Migrate coordinates to aeds table (if not already there)
UPDATE "aeds" a SET
  latitude = COALESCE(a.latitude, l.latitude),
  longitude = COALESCE(a.longitude, l.longitude),
  coordinates_precision = COALESCE(a.coordinates_precision, l.coordinates_precision)
FROM "aed_locations" l
WHERE a.location_id = l.id
  AND a.latitude IS NULL
  AND l.latitude IS NOT NULL;

-- 2.3 AED_LOCATIONS TABLE: Consolidate location fields into location_details
UPDATE "aed_locations" SET
  location_details = CONCAT_WS(' - ',
    NULLIF(TRIM(additional_info), ''),
    NULLIF(TRIM(specific_location), '')
  )
WHERE (additional_info IS NOT NULL AND additional_info != '')
   OR (specific_location IS NOT NULL AND specific_location != '');

-- 2.4 AED_LOCATIONS TABLE: Consolidate access fields into access_instructions
UPDATE "aed_locations" SET
  access_instructions = CONCAT_WS(E'\n',
    NULLIF(TRIM(access_instructions), ''),
    CASE WHEN access_description IS NOT NULL AND access_description != ''
         THEN CONCAT('Acceso: ', access_description) END,
    CASE WHEN visible_references IS NOT NULL AND visible_references != ''
         THEN CONCAT('Referencias: ', visible_references) END,
    CASE WHEN access_warnings IS NOT NULL AND access_warnings != ''
         THEN CONCAT('⚠️ ', access_warnings) END,
    CASE WHEN location_observations IS NOT NULL AND location_observations != ''
         THEN CONCAT('Notas: ', location_observations) END,
    CASE WHEN public_notes IS NOT NULL AND public_notes != ''
         THEN public_notes END
  )
WHERE access_description IS NOT NULL
   OR visible_references IS NOT NULL
   OR access_warnings IS NOT NULL
   OR location_observations IS NOT NULL
   OR public_notes IS NOT NULL;

-- 2.5 AED_SCHEDULES TABLE: Consolidate schedule notes
UPDATE "aed_schedules" SET
  notes = CONCAT_WS(E'\n',
    NULLIF(TRIM(observations), ''),
    CASE WHEN schedule_exceptions IS NOT NULL AND schedule_exceptions != ''
         THEN CONCAT('Excepciones: ', schedule_exceptions) END,
    CASE WHEN access_instructions IS NOT NULL AND access_instructions != ''
         THEN CONCAT('Acceso: ', access_instructions) END
  )
WHERE observations IS NOT NULL
   OR schedule_exceptions IS NOT NULL
   OR access_instructions IS NOT NULL;

-- Keep description as is (already contains schedule description)

-- 2.6 AED_RESPONSIBLES TABLE: Convert notes to JSON format
UPDATE "aed_responsibles" SET
  notes = jsonb_build_array(
    jsonb_strip_nulls(jsonb_build_object(
      'text', CONCAT_WS(E'\n',
        NULLIF(TRIM(observations), ''),
        NULLIF(TRIM(contact_notes), '')
      ),
      'migrated_at', NOW()::TEXT,
      'type', 'migration_consolidation'
    ))
  )::jsonb
WHERE observations IS NOT NULL
   OR contact_notes IS NOT NULL;

-- ============================================
-- PHASE 3: DROP DEPRECATED/REDUNDANT COLUMNS
-- ============================================

-- 3.1 AEDS TABLE: Remove deprecated and consolidated fields
ALTER TABLE "aeds" DROP COLUMN IF EXISTS "origin_observations";
ALTER TABLE "aeds" DROP COLUMN IF EXISTS "validation_observations";
ALTER TABLE "aeds" DROP COLUMN IF EXISTS "validation_notes";
ALTER TABLE "aeds" DROP COLUMN IF EXISTS "attention_reason";
ALTER TABLE "aeds" DROP COLUMN IF EXISTS "publication_notes";

-- 3.2 AED_LOCATIONS TABLE: Remove coordinates (now only in aeds)
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "longitude";
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "coordinates_precision";

-- 3.3 AED_LOCATIONS TABLE: Remove deprecated and consolidated fields
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "additional_info";
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "specific_location";
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "public_notes";
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "access_description";
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "visible_references";
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "access_warnings";
ALTER TABLE "aed_locations" DROP COLUMN IF EXISTS "location_observations";

-- 3.4 AED_SCHEDULES TABLE: Remove consolidated fields
ALTER TABLE "aed_schedules" DROP COLUMN IF EXISTS "observations";
ALTER TABLE "aed_schedules" DROP COLUMN IF EXISTS "schedule_exceptions";
ALTER TABLE "aed_schedules" DROP COLUMN IF EXISTS "access_instructions";

-- 3.5 AED_RESPONSIBLES TABLE: Remove old note fields
ALTER TABLE "aed_responsibles" DROP COLUMN IF EXISTS "observations";
ALTER TABLE "aed_responsibles" DROP COLUMN IF EXISTS "contact_notes";

-- ============================================
-- PHASE 4: DROP UNUSED INDEXES
-- ============================================

-- Remove spatial index on aed_locations (coordinates moved to aeds)
DROP INDEX IF EXISTS "idx_location_spatial";

-- ============================================
-- PHASE 5: VERIFICATION QUERIES (for manual check)
-- ============================================

-- You can run these queries to verify the migration:
-- SELECT COUNT(*) FROM aeds WHERE internal_notes IS NOT NULL;
-- SELECT COUNT(*) FROM aed_locations WHERE location_details IS NOT NULL;
-- SELECT COUNT(*) FROM aed_schedules WHERE notes IS NOT NULL;
-- SELECT COUNT(*) FROM aed_responsibles WHERE notes IS NOT NULL;
