-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_LESSON', 'NEW_QUIZ', 'NEW_CHAPTER');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "courseContextId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_studentId_isRead_createdAt_idx" ON "notifications"("studentId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_studentId_createdAt_idx" ON "notifications"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
