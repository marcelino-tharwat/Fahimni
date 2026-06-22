/*
  Warnings:

  - You are about to drop the column `revokedAt` on the `refresh_tokens` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "refresh_tokens_expiresAt_idx";

-- DropIndex
DROP INDEX "refresh_tokens_userId_idx";

-- AlterTable
ALTER TABLE "refresh_tokens" DROP COLUMN "revokedAt";
