-- AlterTable
-- Defaults to true (grandfathers every existing row and every other
-- user-creation path in the codebase — seeds, admin tooling, e2e test
-- fixtures). Only registerUser's public self-registration path explicitly
-- overrides this to false.
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT true;
