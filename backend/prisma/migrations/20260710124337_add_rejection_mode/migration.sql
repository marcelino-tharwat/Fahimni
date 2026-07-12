-- CreateEnum
CREATE TYPE "RejectionMode" AS ENUM ('EDIT_ALLOWED', 'FINAL_REJECTION');

-- AlterTable
ALTER TABLE "teacher_registration_requests" ADD COLUMN     "rejectionMode" "RejectionMode";
