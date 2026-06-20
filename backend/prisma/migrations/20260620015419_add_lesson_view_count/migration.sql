-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "lesson_materials_lessonId_idx" ON "lesson_materials"("lessonId");

-- AddForeignKey
ALTER TABLE "lesson_materials" ADD CONSTRAINT "lesson_materials_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
