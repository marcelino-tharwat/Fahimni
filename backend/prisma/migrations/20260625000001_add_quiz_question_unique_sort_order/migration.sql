-- Drop the existing composite index
DROP INDEX IF EXISTS "questions_quizId_sortOrder_idx";

-- Add unique constraint to prevent duplicate sortOrder within a quiz
ALTER TABLE "questions" ADD CONSTRAINT "questions_quizId_sortOrder_key" UNIQUE ("quizId", "sortOrder");
