-- Extend audit_logs into a reusable activity stream.
-- All new columns are nullable so the migration is non-destructive and
-- compatible with existing rows (which were teacher-authored DELETE events).

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actorType" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN     "actorName" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN     "scopeTeacherId" TEXT;

-- Backfill existing rows: prior events were all teacher-authored content
-- deletions, so the actor is the owning teacher.
UPDATE "audit_logs"
SET "scopeTeacherId" = "userId",
    "actorType" = 'TEACHER'
WHERE "scopeTeacherId" IS NULL;

-- CreateIndex
CREATE INDEX "audit_logs_scopeTeacherId_createdAt_idx" ON "audit_logs"("scopeTeacherId", "createdAt");
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");
