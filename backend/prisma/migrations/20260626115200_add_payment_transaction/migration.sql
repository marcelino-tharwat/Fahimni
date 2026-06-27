-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAYMOB';

-- DropForeignKey & Index Safety
ALTER TABLE "content_chunks" DROP CONSTRAINT IF EXISTS "content_chunks_lesson_id_fkey";
DROP INDEX IF EXISTS "content_chunks_lesson_id_idx";

-- AlterTable (Surgically handling columns to avoid collisions)
ALTER TABLE "content_chunks" DROP COLUMN IF EXISTS "created_at";
ALTER TABLE "content_chunks" DROP COLUMN IF EXISTS "lesson_id";
ALTER TABLE "content_chunks" DROP COLUMN IF EXISTS "updated_at";

-- Add columns only if they do not exist
ALTER TABLE "content_chunks" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "content_chunks" ADD COLUMN IF NOT EXISTS "lessonId" TEXT;
ALTER TABLE "content_chunks" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Enforce NOT NULL and structural rules safely after creation
ALTER TABLE "content_chunks" ALTER COLUMN "lessonId" SET NOT NULL;
ALTER TABLE "content_chunks" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "content_chunks" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable Safely
CREATE TABLE IF NOT EXISTS "payment_transactions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "paymobOrderId" TEXT,
    "paymobTransactionId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "rawCallback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes Safely
DROP INDEX IF EXISTS "payment_transactions_paymobOrderId_key";
CREATE UNIQUE INDEX "payment_transactions_paymobOrderId_key" ON "payment_transactions"("paymobOrderId");

DROP INDEX IF EXISTS "payment_transactions_studentId_idx";
CREATE INDEX "payment_transactions_studentId_idx" ON "payment_transactions"("studentId");

DROP INDEX IF EXISTS "payment_transactions_chapterId_idx";
CREATE INDEX "payment_transactions_chapterId_idx" ON "payment_transactions"("chapterId");

DROP INDEX IF EXISTS "content_chunks_lessonId_idx";
CREATE INDEX "content_chunks_lessonId_idx" ON "content_chunks"("lessonId");

-- AddForeignKeys Safely (Drop first if they exist to prevent duplication errors)
ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_studentId_fkey";
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_chapterId_fkey";
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "content_chunks" DROP CONSTRAINT IF EXISTS "content_chunks_lessonId_fkey";
ALTER TABLE "content_chunks" ADD CONSTRAINT "content_chunks_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quizzes" DROP CONSTRAINT IF EXISTS "quizzes_createdBy_fkey";
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
