-- AlterTable: Update foreign key constraints for cascade delete policies
-- This migration adds proper ON DELETE behaviors to AED relationships

-- ============================================
-- AED -> LOCATION (Cascade Delete)
-- ============================================
-- When an AED is deleted, its location should be deleted too
ALTER TABLE "aeds" DROP CONSTRAINT IF EXISTS "aeds_location_id_fkey";

ALTER TABLE "aeds"
  ADD CONSTRAINT "aeds_location_id_fkey"
  FOREIGN KEY ("location_id")
  REFERENCES "aed_locations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- ============================================
-- AED -> RESPONSIBLE (Set NULL)
-- ============================================
-- When an AED is deleted, keep the responsible (may manage other AEDs)
ALTER TABLE "aeds" DROP CONSTRAINT IF EXISTS "aeds_responsible_id_fkey";

ALTER TABLE "aeds"
  ADD CONSTRAINT "aeds_responsible_id_fkey"
  FOREIGN KEY ("responsible_id")
  REFERENCES "aed_responsibles"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ============================================
-- AED -> SCHEDULE (Cascade Delete)
-- ============================================
-- When an AED is deleted, its schedule should be deleted too
ALTER TABLE "aeds" DROP CONSTRAINT IF EXISTS "aeds_schedule_id_fkey";

ALTER TABLE "aeds"
  ADD CONSTRAINT "aeds_schedule_id_fkey"
  FOREIGN KEY ("schedule_id")
  REFERENCES "aed_schedules"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
