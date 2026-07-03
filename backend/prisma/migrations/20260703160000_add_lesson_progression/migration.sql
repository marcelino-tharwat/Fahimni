-- Additive progression fields: optional required quiz per lesson + optional pass threshold.
ALTER TABLE "lessons" ADD COLUMN "required_quiz_id" TEXT;

ALTER TABLE "quizzes" ADD COLUMN "passing_score" INTEGER;

ALTER TABLE "lessons"
  ADD CONSTRAINT "lessons_required_quiz_id_fkey"
  FOREIGN KEY ("required_quiz_id") REFERENCES "quizzes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "lessons_required_quiz_id_idx" ON "lessons"("required_quiz_id");
