-- Migration: High Priority Schema Optimizations
-- Date: 2025-01-10
-- Description: Add verification/accessibility fields, remove redundant started_at, optimize indexes

-- =====================================================
-- STEP 1: Add new fields to aeds table
-- =====================================================

-- Add verification and accessibility fields
ALTER TABLE aeds
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verification_method TEXT,
ADD COLUMN IF NOT EXISTS is_publicly_accessible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS installation_date TIMESTAMP;

-- =====================================================
-- STEP 2: Remove redundant started_at from import_batches
-- =====================================================

-- Drop started_at column (redundant with created_at)
ALTER TABLE import_batches
DROP COLUMN IF EXISTS started_at;

-- =====================================================
-- STEP 3: Optimize indexes
-- =====================================================

-- Drop rarely used sequence index
DROP INDEX IF EXISTS aeds_sequence_idx;

-- Add new strategic indexes for common queries
CREATE INDEX IF NOT EXISTS aeds_last_verified_at_idx
ON aeds(last_verified_at);

CREATE INDEX IF NOT EXISTS aeds_is_publicly_accessible_status_idx
ON aeds(is_publicly_accessible, status);

CREATE INDEX IF NOT EXISTS aed_locations_city_code_postal_code_idx
ON aed_locations(city_code, postal_code);

-- =====================================================
-- STEP 4: Add column comments
-- =====================================================

COMMENT ON COLUMN aeds.last_verified_at IS 'Date of last physical verification of the AED (field visit, photo, etc.)';
COMMENT ON COLUMN aeds.verification_method IS 'Method used for verification: field_visit, phone_call, email, photo_verification';
COMMENT ON COLUMN aeds.is_publicly_accessible IS 'Whether the AED is accessible to the general public without restrictions';
COMMENT ON COLUMN aeds.installation_date IS 'Date when the AED was physically installed';

-- =====================================================
-- STEP 5: Data migration notes
-- =====================================================

-- Note: All new fields are nullable or have defaults, no data migration needed
-- Note: started_at removal is safe - created_at serves the same purpose
-- Note: is_publicly_accessible defaults to true (existing AEDs remain public)

-- =====================================================
-- VERIFICATION QUERIES (for manual check after migration)
-- =====================================================

DO $$
DECLARE
  aeds_count INTEGER;
  batches_count INTEGER;
  new_indexes_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO aeds_count FROM aeds;
  SELECT COUNT(*) INTO batches_count FROM import_batches;
  SELECT COUNT(*) INTO new_indexes_count
  FROM pg_indexes
  WHERE tablename IN ('aeds', 'aed_locations')
  AND indexname IN (
    'aeds_last_verified_at_idx',
    'aeds_is_publicly_accessible_status_idx',
    'aed_locations_city_code_postal_code_idx'
  );

  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '  - Total AEDs: %', aeds_count;
  RAISE NOTICE '  - Total import batches: %', batches_count;
  RAISE NOTICE '  - New indexes created: %/3', new_indexes_count;
  RAISE NOTICE '  - All AEDs set to publicly accessible by default: true';
END $$;
