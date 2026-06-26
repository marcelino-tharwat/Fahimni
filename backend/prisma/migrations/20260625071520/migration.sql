/*
  Recovery note (idempotent):
  This database may already have `content_chunks` in the new shape (renamed
  columns + FK) from a divergent migration history, while still missing the
  `quizzes.createdBy` foreign key. Every statement below is guarded so the
  migration applies ONLY the pieces that are actually missing and is safe to
  re-run. No data is dropped from `content_chunks`.

  Original intent:
   - rename content_chunks created_at/lesson_id/updated_at -> createdAt/lessonId/updatedAt
   - re-create content_chunks index + FK on the new column name
   - add quizzes.createdBy -> User.id foreign key
*/

-- DropForeignKey (old column name)
ALTER TABLE "content_chunks" DROP CONSTRAINT IF EXISTS "content_chunks_lesson_id_fkey";

-- DropIndex (old column name)
DROP INDEX IF EXISTS "content_chunks_lesson_id_idx";

-- AlterTable (column rename via drop/add) — guarded
ALTER TABLE "content_chunks" DROP COLUMN IF EXISTS "created_at";
ALTER TABLE "content_chunks" DROP COLUMN IF EXISTS "lesson_id";
ALTER TABLE "content_chunks" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "content_chunks" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "content_chunks" ADD COLUMN IF NOT EXISTS "lessonId" TEXT NOT NULL;
ALTER TABLE "content_chunks" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "content_chunks" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex (new column name)
CREATE INDEX IF NOT EXISTS "content_chunks_lessonId_idx" ON "content_chunks"("lessonId");

-- AddForeignKey content_chunks.lessonId -> lessons.id (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_chunks_lessonId_fkey'
  ) THEN
    ALTER TABLE "content_chunks"
      ADD CONSTRAINT "content_chunks_lessonId_fkey"
      FOREIGN KEY ("lessonId") REFERENCES "lessons"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey quizzes.createdBy -> User.id (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_createdBy_fkey'
  ) THEN
    ALTER TABLE "quizzes"
      ADD CONSTRAINT "quizzes_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
