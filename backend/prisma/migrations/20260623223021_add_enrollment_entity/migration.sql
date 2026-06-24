/*
  Warnings:

  - The `status` column on the `enrollments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `enrolledMonth` to the `enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `enrolledYear` to the `enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentMethod` to the `enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `enrollments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'VISA', 'PROMO');

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "enrolledMonth" INTEGER NOT NULL,
ADD COLUMN     "enrolledYear" INTEGER NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL,
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "promoCodeId" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "enrollments_studentId_idx" ON "enrollments"("studentId");

-- CreateIndex
CREATE INDEX "enrollments_chapterId_idx" ON "enrollments"("chapterId");
