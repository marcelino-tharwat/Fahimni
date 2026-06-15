-- The "chapters" table, its "deletedAt" column, and the "chapters_stageId_idx"
-- index are already created by 20260615143035_update_chapter_entity.
-- This migration originally targeted the legacy "Chapter" table, which is
-- dropped by that earlier migration (causing P3006 / 42P01). It is corrected
-- to target the real "chapters" table and made idempotent so the history
-- applies cleanly from an empty (and shadow) database without duplicating
-- the column or index.

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chapters_stageId_idx" ON "chapters"("stageId");
