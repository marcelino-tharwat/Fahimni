-- CreateEnum
CREATE TYPE "TeacherApprovalState" AS ENUM ('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "teacherApprovalState" "TeacherApprovalState" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "teacher_registration_requests" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "teacher_registration_requests_userId_key" ON "teacher_registration_requests"("userId");

-- AddForeignKey
ALTER TABLE "teacher_registration_requests" ADD CONSTRAINT "teacher_registration_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
