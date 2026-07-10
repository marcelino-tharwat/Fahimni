-- DropForeignKey
ALTER TABLE "stages" DROP CONSTRAINT "stages_teacherId_fkey";

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "teacherId" TEXT;

-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "teacherId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "chapters_teacherId_idx" ON "chapters"("teacherId");

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
