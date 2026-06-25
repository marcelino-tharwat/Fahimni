-- AlterTable: add createdBy to quizzes
-- Use a placeholder UUID for existing rows, then make it NOT NULL
ALTER TABLE "quizzes" ADD COLUMN "createdBy" TEXT;
UPDATE "quizzes" SET "createdBy" = (SELECT id FROM "User" LIMIT 1) WHERE "createdBy" IS NULL;
ALTER TABLE "quizzes" ALTER COLUMN "createdBy" SET NOT NULL;

-- AlterTable: add sortOrder to questions
ALTER TABLE "questions" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: composite index for question ordering
CREATE INDEX IF NOT EXISTS "questions_quizId_sortOrder_idx" ON "questions"("quizId", "sortOrder");
