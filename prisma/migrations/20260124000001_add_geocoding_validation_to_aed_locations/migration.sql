-- Add geocoding_validation field to aed_locations table
-- This field stores automatic geocoding enrichment validation results

ALTER TABLE "aed_locations"
ADD COLUMN "geocoding_validation" JSONB;

-- Add comment to explain the field
COMMENT ON COLUMN "aed_locations"."geocoding_validation" IS 'Validation result from automatic geocoding enrichment. Contains: {status: "VALID"|"NEEDS_VERIFICATION"|"INVALID"|"NO_COMPARISON", distance_meters, original_coords, geocoded_coords, reason, validated_at}';
