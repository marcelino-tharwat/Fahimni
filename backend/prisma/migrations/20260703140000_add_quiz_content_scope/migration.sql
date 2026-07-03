-- Add canonical quiz content scope and lesson relations (additive, non-destructive).

CREATE TYPE "QuizContentScope" AS ENUM ('CHAPTER', 'SELECTED_LESSONS');

ALTER TABLE "quizzes" ADD COLUMN "content_scope" "QuizContentScope" NOT NULL DEFAULT 'CHAPTER';

CREATE TABLE "quiz_lessons" (
    "quizId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "quiz_lessons_pkey" PRIMARY KEY ("quizId","lessonId")
);

CREATE INDEX "quiz_lessons_lessonId_idx" ON "quiz_lessons"("lessonId");

ALTER TABLE "quiz_lessons" ADD CONSTRAINT "quiz_lessons_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quiz_lessons" ADD CONSTRAINT "quiz_lessons_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing quizzes without lesson relations are chapter-scoped.
UPDATE "quizzes" SET "content_scope" = 'CHAPTER' WHERE "content_scope" IS NULL;
