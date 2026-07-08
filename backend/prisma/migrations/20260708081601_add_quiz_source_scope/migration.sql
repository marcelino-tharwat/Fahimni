-- CreateEnum
CREATE TYPE "QuizSourceScope" AS ENUM ('SINGLE_CHAPTER', 'MULTI_CHAPTER', 'FULL_CURRICULUM');

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "source_chapter_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "source_scope" "QuizSourceScope" NOT NULL DEFAULT 'SINGLE_CHAPTER',
ADD COLUMN     "source_stage_id" TEXT;
