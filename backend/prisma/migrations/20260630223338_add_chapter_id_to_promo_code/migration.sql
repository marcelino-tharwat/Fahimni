/*
  Warnings:

  - Added the required column `chapterId` to the `promo_codes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "promo_codes" ADD COLUMN     "chapterId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "promo_codes_chapterId_idx" ON "promo_codes"("chapterId");

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
