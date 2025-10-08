-- Migration: Change verification table IDs from INTEGER to CUID (TEXT)
-- This migration will delete existing data and change ID types

-- Step 1: Delete existing data (safe since we're in development)
-- Delete in correct order: child tables first
DELETE FROM "processed_images";
DELETE FROM "arrow_markers";
DELETE FROM "verification_sessions";

-- Step 2: Drop existing foreign key constraints
ALTER TABLE "arrow_markers" DROP CONSTRAINT IF EXISTS "arrow_markers_verification_session_id_fkey";
ALTER TABLE "processed_images" DROP CONSTRAINT IF EXISTS "processed_images_verification_session_id_fkey";
ALTER TABLE "verification_sessions" DROP CONSTRAINT IF EXISTS "verification_sessions_dea_record_id_fkey";

-- Step 3: Drop DEFAULT values first (required before dropping sequences)
ALTER TABLE "verification_sessions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "arrow_markers" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "processed_images" ALTER COLUMN "id" DROP DEFAULT;

-- Step 4: Drop sequences (no longer needed with CUID)
DROP SEQUENCE IF EXISTS "verification_sessions_id_seq";
DROP SEQUENCE IF EXISTS "arrow_markers_id_seq";
DROP SEQUENCE IF EXISTS "processed_images_id_seq";

-- Step 5: Change column types from INTEGER to TEXT
ALTER TABLE "verification_sessions" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "arrow_markers" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "arrow_markers" ALTER COLUMN "verification_session_id" TYPE TEXT;
ALTER TABLE "processed_images" ALTER COLUMN "id" TYPE TEXT;
ALTER TABLE "processed_images" ALTER COLUMN "verification_session_id" TYPE TEXT;

-- Step 6: Recreate foreign key constraints with new TEXT type
ALTER TABLE "verification_sessions" 
  ADD CONSTRAINT "verification_sessions_dea_record_id_fkey" 
  FOREIGN KEY ("dea_record_id") REFERENCES "dea_records"("id") 
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "arrow_markers" 
  ADD CONSTRAINT "arrow_markers_verification_session_id_fkey" 
  FOREIGN KEY ("verification_session_id") REFERENCES "verification_sessions"("id") 
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "processed_images" 
  ADD CONSTRAINT "processed_images_verification_session_id_fkey" 
  FOREIGN KEY ("verification_session_id") REFERENCES "verification_sessions"("id") 
  ON DELETE RESTRICT ON UPDATE CASCADE;
