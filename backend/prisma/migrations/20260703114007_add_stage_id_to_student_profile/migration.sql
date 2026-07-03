/*
  Warnings:

  - Added the required column `stageId` to the `student_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "stageId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "student_profiles_stageId_idx" ON "student_profiles"("stageId");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
