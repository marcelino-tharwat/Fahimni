/*
  STORY-48 — additive, idempotent migration.

  Adds the QuizAttempt lifecycle fields + the one-attempt-per-student constraint,
  and ensures the points/totalPoints/questionCount columns exist. Some columns
  (questions.points, quizzes.questionCount/totalPoints) already exist on databases
  migrated by an earlier branch, so they are guarded with IF NOT EXISTS; on a fresh
  database (e.g. the isolated test DB) they are created here. No data is dropped.
*/

-- Enum: AttemptStatus
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttemptStatus') THEN
    CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'GRADED');
  END IF;
END $$;

-- Quiz: questionCount / totalPoints
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "questionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "totalPoints" INTEGER NOT NULL DEFAULT 0;

-- Question: points
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 1;

-- QuizAttempt: lifecycle fields
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "totalPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Backfill startedAt from createdAt for any pre-existing rows.
UPDATE "quiz_attempts" SET "startedAt" = "createdAt" WHERE "startedAt" > "createdAt";

-- One attempt per (quiz, student)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_quizId_studentId_key'
  ) THEN
    ALTER TABLE "quiz_attempts"
      ADD CONSTRAINT "quiz_attempts_quizId_studentId_key" UNIQUE ("quizId", "studentId");
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "quiz_attempts_studentId_idx" ON "quiz_attempts"("studentId");
CREATE INDEX IF NOT EXISTS "quiz_attempts_quizId_idx" ON "quiz_attempts"("quizId");
CREATE INDEX IF NOT EXISTS "quizzes_chapterId_status_idx" ON "quizzes"("chapterId", "status");
