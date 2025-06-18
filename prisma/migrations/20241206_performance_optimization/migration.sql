-- Performance optimization indexes for DEA verification queries
-- This migration adds indexes to improve the performance of the verify API endpoint

-- Index for foto1 filtering (records with images)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_dea_records_foto1_not_null" 
ON "dea_records" ("foto1") 
WHERE "foto1" IS NOT NULL AND "foto1" != '';

-- Composite index for verification sessions status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_verification_sessions_status_dea_id" 
ON "verification_sessions" ("status", "dea_record_id");

-- Index for address validation status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_dea_address_validations_status_dea_id" 
ON "dea_address_validations" ("overall_status", "dea_record_id");

-- Composite index for the main query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_dea_records_foto1_created_at" 
ON "dea_records" ("foto1", "created_at" DESC) 
WHERE "foto1" IS NOT NULL AND "foto1" != '';

-- Index to optimize the JOIN with address validations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_dea_address_validations_dea_record_id_status" 
ON "dea_address_validations" ("dea_record_id", "overall_status");
