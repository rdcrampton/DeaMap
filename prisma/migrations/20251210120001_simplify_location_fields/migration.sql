-- Migration: Simplify location and notes fields
-- Date: 2025-01-10
-- Description: Consolidate redundant fields for better UX

-- =====================================================
-- STEP 1: Add new simplified fields
-- =====================================================

-- Add new fields to aed_locations (public information)
ALTER TABLE aed_locations
ADD COLUMN IF NOT EXISTS access_instructions TEXT,
ADD COLUMN IF NOT EXISTS public_notes TEXT;

-- Add new fields to aeds (private information)
ALTER TABLE aeds
ADD COLUMN IF NOT EXISTS public_notes TEXT,
ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- =====================================================
-- STEP 2: Migrate existing data to new fields
-- =====================================================

-- Migrate access-related fields to access_instructions
UPDATE aed_locations
SET access_instructions = CONCAT_WS('. ',
  NULLIF(TRIM(access_description), ''),
  NULLIF(TRIM(visible_references), ''),
  NULLIF(TRIM(access_warnings), '')
)
WHERE access_description IS NOT NULL
   OR visible_references IS NOT NULL
   OR access_warnings IS NOT NULL;

-- Migrate location observations to public_notes in locations
UPDATE aed_locations
SET public_notes = NULLIF(TRIM(location_observations), '')
WHERE location_observations IS NOT NULL;

-- Migrate origin_observations to internal_notes in aeds
UPDATE aeds
SET internal_notes = CASE
  WHEN internal_notes IS NOT NULL AND origin_observations IS NOT NULL
    THEN CONCAT_WS('. ', NULLIF(TRIM(internal_notes), ''), NULLIF(TRIM(origin_observations), ''))
  WHEN internal_notes IS NOT NULL
    THEN NULLIF(TRIM(internal_notes), '')
  WHEN origin_observations IS NOT NULL
    THEN NULLIF(TRIM(origin_observations), '')
  ELSE NULL
END
WHERE internal_notes IS NOT NULL OR origin_observations IS NOT NULL;

-- Migrate validation_observations to validation_notes
UPDATE aeds
SET validation_notes = NULLIF(TRIM(validation_observations), '')
WHERE validation_observations IS NOT NULL;

-- =====================================================
-- STEP 3: Mark old fields as deprecated (comments only)
-- =====================================================

COMMENT ON COLUMN aed_locations.access_description IS 'DEPRECATED: Use access_instructions instead. Will be removed in future version.';
COMMENT ON COLUMN aed_locations.visible_references IS 'DEPRECATED: Use access_instructions instead. Will be removed in future version.';
COMMENT ON COLUMN aed_locations.access_warnings IS 'DEPRECATED: Use access_instructions instead. Will be removed in future version.';
COMMENT ON COLUMN aed_locations.location_observations IS 'DEPRECATED: Use public_notes instead. Will be removed in future version.';
COMMENT ON COLUMN aeds.origin_observations IS 'DEPRECATED: Merged into internal_notes. Will be removed in future version.';
COMMENT ON COLUMN aeds.validation_observations IS 'DEPRECATED: Use validation_notes instead. Will be removed in future version.';

-- =====================================================
-- STEP 4: Create indexes for new fields (for search)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_aed_locations_access_instructions
ON aed_locations USING gin(to_tsvector('spanish', COALESCE(access_instructions, '')));

CREATE INDEX IF NOT EXISTS idx_aed_locations_public_notes
ON aed_locations USING gin(to_tsvector('spanish', COALESCE(public_notes, '')));

-- =====================================================
-- STEP 5: Add comments to new fields
-- =====================================================

COMMENT ON COLUMN aed_locations.access_instructions IS 'Complete instructions on how to access the DEA. Combines description, visible references, and warnings. Public information.';
COMMENT ON COLUMN aed_locations.public_notes IS 'Additional public notes about the location. Public information visible on map.';
COMMENT ON COLUMN aeds.public_notes IS 'Additional public information about the DEA. Visible to all users.';
COMMENT ON COLUMN aeds.validation_notes IS 'Notes from the validation process. Private information for administrators only.';

-- =====================================================
-- VERIFICATION QUERIES (for manual check after migration)
-- =====================================================

-- Count records that were migrated
DO $$
DECLARE
  migrated_access INTEGER;
  migrated_public INTEGER;
  migrated_internal INTEGER;
  migrated_validation INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_access FROM aed_locations WHERE access_instructions IS NOT NULL;
  SELECT COUNT(*) INTO migrated_public FROM aed_locations WHERE public_notes IS NOT NULL;
  SELECT COUNT(*) INTO migrated_internal FROM aeds WHERE internal_notes IS NOT NULL;
  SELECT COUNT(*) INTO migrated_validation FROM aeds WHERE validation_notes IS NOT NULL;

  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '  - Access instructions migrated: % records', migrated_access;
  RAISE NOTICE '  - Public notes migrated: % records', migrated_public;
  RAISE NOTICE '  - Internal notes migrated: % records', migrated_internal;
  RAISE NOTICE '  - Validation notes migrated: % records', migrated_validation;
END $$;
