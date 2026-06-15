-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Chapter_stageId_idx" ON "Chapter"("stageId");
