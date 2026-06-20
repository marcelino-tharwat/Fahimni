/*
  Warnings:

  - Added the required column `displayName` to the `lesson_materials` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add columns as nullable so existing rows are accepted
ALTER TABLE "lesson_materials"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "fileSize" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/pdf';

-- Step 2: Backfill displayName for existing rows using the last segment of filePath
-- (e.g. "teachers/uuid/lessons/uuid/uuid.pdf" → "uuid.pdf")
-- Note: fileSize and mimeType for legacy rows are set to defaults (0, 'application/pdf')
-- because the original upload metadata was never persisted and cannot be reconstructed
-- without re-reading the files from storage.
UPDATE "lesson_materials"
SET "displayName" = reverse(split_part(reverse("filePath"), '/', 1))
WHERE "displayName" IS NULL;

-- Step 3: Make displayName NOT NULL now that all rows have a value
ALTER TABLE "lesson_materials"
  ALTER COLUMN "displayName" SET NOT NULL;
