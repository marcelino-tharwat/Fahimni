-- Add server-authoritative attempt timing and draft metadata (additive).
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "duration_minutes_snapshot" INTEGER;
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "submission_reason" TEXT;
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "last_saved_at" TIMESTAMP(3);

-- Backfill in-progress attempts from quiz duration (skip when quiz has no duration).
UPDATE "quiz_attempts" AS qa
SET
  "duration_minutes_snapshot" = q."duration_minutes",
  "expires_at" = qa."startedAt" + (q."duration_minutes" * INTERVAL '1 minute')
FROM "quizzes" AS q
WHERE qa."quizId" = q."id"
  AND qa."status" = 'IN_PROGRESS'
  AND qa."expires_at" IS NULL
  AND q."duration_minutes" IS NOT NULL
  AND q."duration_minutes" > 0;
