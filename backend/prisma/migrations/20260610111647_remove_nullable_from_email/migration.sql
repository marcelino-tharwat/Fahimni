/*
  Warnings:

  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "teacher_profiles" ALTER COLUMN "subject" DROP NOT NULL,
ALTER COLUMN "bio" DROP NOT NULL;
