-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'DRY_RUN', 'SKIPPED_DUPLICATE');

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "status" "EmailLogStatus" NOT NULL,
    "providerMessageId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_dedupeKey_key" ON "email_logs"("dedupeKey");

-- CreateIndex
CREATE INDEX "email_logs_template_createdAt_idx" ON "email_logs"("template", "createdAt");

-- CreateIndex
CREATE INDEX "email_logs_status_createdAt_idx" ON "email_logs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "email_logs_locale_createdAt_idx" ON "email_logs"("locale", "createdAt");

-- CreateIndex
CREATE INDEX "email_logs_entityType_entityId_idx" ON "email_logs"("entityType", "entityId");
