-- CreateTable
CREATE TABLE "ai_tutor_usage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "usageDate" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tutor_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_tutor_usage_studentId_idx" ON "ai_tutor_usage"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_tutor_usage_studentId_usageDate_key" ON "ai_tutor_usage"("studentId", "usageDate");

-- AddForeignKey
ALTER TABLE "ai_tutor_usage" ADD CONSTRAINT "ai_tutor_usage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
