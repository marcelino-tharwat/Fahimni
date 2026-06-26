/*
  Warnings:

  - You are about to drop the column `created_at` on the `content_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `lesson_id` on the `content_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `content_chunks` table. All the data in the column will be lost.
  - Added the required column `lessonId` to the `content_chunks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `content_chunks` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'PAYMENT_PENDING';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYMOB';

-- DropForeignKey
ALTER TABLE "content_chunks" DROP CONSTRAINT "content_chunks_lesson_id_fkey";

-- DropIndex
DROP INDEX "content_chunks_lesson_id_idx";

-- AlterTable
ALTER TABLE "content_chunks" DROP COLUMN "created_at",
DROP COLUMN "lesson_id",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lessonId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "payment_transactions" (
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

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_paymobOrderId_key" ON "payment_transactions"("paymobOrderId");

-- CreateIndex
CREATE INDEX "payment_transactions_studentId_idx" ON "payment_transactions"("studentId");

-- CreateIndex
CREATE INDEX "payment_transactions_chapterId_idx" ON "payment_transactions"("chapterId");

-- CreateIndex
CREATE INDEX "content_chunks_lessonId_idx" ON "content_chunks"("lessonId");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_chunks" ADD CONSTRAINT "content_chunks_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
