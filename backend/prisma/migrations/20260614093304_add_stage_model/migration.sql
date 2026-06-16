-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stages_teacherId_sortOrder_idx" ON "stages"("teacherId", "sortOrder");

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
