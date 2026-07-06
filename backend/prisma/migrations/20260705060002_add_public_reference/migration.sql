/*
  Additive migration:

  - Added the required column `publicReference` to the `teacher_registration_requests` table.
  - Unique index for `publicReference`.
*/

-- Add column as nullable first to backfill existing rows
ALTER TABLE "teacher_registration_requests" ADD COLUMN "publicReference" TEXT;

-- Backfill existing rows with generated reference numbers (subquery, no window function)
UPDATE "teacher_registration_requests"
SET "publicReference" = sub.ref
FROM (
  SELECT "id", 'TR-2026-' || LPAD(CAST(ROW_NUMBER() OVER (ORDER BY "createdAt") AS TEXT), 4, '0') AS ref
  FROM "teacher_registration_requests"
) sub
WHERE "teacher_registration_requests"."id" = sub.id;

-- Make NOT NULL after backfill
ALTER TABLE "teacher_registration_requests" ALTER COLUMN "publicReference" SET NOT NULL;

-- Create unique index
CREATE UNIQUE INDEX "TeacherRegistrationRequest_publicReference_key" ON "teacher_registration_requests"("publicReference");
