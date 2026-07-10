-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "instaPayHandle" TEXT,
ADD COLUMN     "vodafoneCashNumber" TEXT,
ADD COLUMN     "payoutMethodUpdatedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "TeacherWithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'TRANSFERRED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "teacher_withdrawal_requests" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "status" "TeacherWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "payoutMethodSnapshot" JSONB,
    "teacherNote" TEXT,
    "adminNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_withdrawal_requests_teacherId_idx" ON "teacher_withdrawal_requests"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_withdrawal_requests_teacherId_status_idx" ON "teacher_withdrawal_requests"("teacherId", "status");

-- AddForeignKey
ALTER TABLE "teacher_withdrawal_requests" ADD CONSTRAINT "teacher_withdrawal_requests_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_withdrawal_requests" ADD CONSTRAINT "teacher_withdrawal_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
