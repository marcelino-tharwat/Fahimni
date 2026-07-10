/*
  Warnings:

  - Made the column `teacherId` on table `chapters` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "chapters" DROP CONSTRAINT "chapters_teacherId_fkey";

-- AlterTable
ALTER TABLE "chapters" ALTER COLUMN "teacherId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
