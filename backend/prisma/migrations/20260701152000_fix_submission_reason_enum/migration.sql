-- Align submission_reason with Prisma AttemptSubmissionReason enum (additive fix).
DO $$ BEGIN
  CREATE TYPE "AttemptSubmissionReason" AS ENUM ('MANUAL', 'TIME_EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "quiz_attempts" DROP COLUMN IF EXISTS "submission_reason";
ALTER TABLE "quiz_attempts" ADD COLUMN "submission_reason" "AttemptSubmissionReason";
