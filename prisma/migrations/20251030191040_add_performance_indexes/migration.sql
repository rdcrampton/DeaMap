-- AddPerformanceIndexes
-- Add performance indexes for verification_sessions and dea_address_validations

-- Index for verification_sessions status queries
CREATE INDEX IF NOT EXISTS "idx_verification_sessions_status" ON "verification_sessions"("status");

-- Composite index for filtering by dea_record_id and status
CREATE INDEX IF NOT EXISTS "idx_verification_sessions_dea_status" ON "verification_sessions"("dea_record_id", "status");

-- Partial index for completed sessions (most common query)
CREATE INDEX IF NOT EXISTS "idx_verification_sessions_completed" ON "verification_sessions"("status", "completed_at") WHERE "status" = 'completed';

-- Index for address validation status filtering
CREATE INDEX IF NOT EXISTS "idx_dea_validations_status_filter" ON "dea_address_validations"("overall_status", "needs_reprocessing");
