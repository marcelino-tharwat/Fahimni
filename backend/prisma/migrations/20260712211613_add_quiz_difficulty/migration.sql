-- CreateEnum
CREATE TYPE "QuizDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "difficulty" "QuizDifficulty" NOT NULL DEFAULT 'MEDIUM';
