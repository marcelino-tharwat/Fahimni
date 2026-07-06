-- CreateEnum
CREATE TYPE "TeacherRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "teacher_registration_requests" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "subject" TEXT,
    "bio" TEXT,
    "status" "TeacherRequestStatus" NOT NULL DEFAULT 'PENDING',
    "proofDocuments" JSONB NOT NULL DEFAULT '[]',
    "adminNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_registration_requests_status_createdAt_idx" ON "teacher_registration_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "teacher_registration_requests_email_idx" ON "teacher_registration_requests"("email");

-- CreateIndex
CREATE INDEX "teacher_registration_requests_mobile_idx" ON "teacher_registration_requests"("mobile");
