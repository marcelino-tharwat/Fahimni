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

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


