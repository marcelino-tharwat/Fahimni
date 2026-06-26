/*
  Drift remediation (forward-only, additive, idempotent).

  The `PromoCode` model (table `promo_codes`) exists in schema.prisma and is used
  by src/modules/promo-code, but the table-creating migration was lost in a merge
  — the table is absent from both the development and the isolated test database
  (confirmed via `prisma migrate diff --from-schema --to-config-datasource`).

  This migration creates `promo_codes` exactly as Prisma defines it. Guarded so it
  is safe on databases where the table may already exist. No data is dropped.
*/

CREATE TABLE IF NOT EXISTS "promo_codes" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedByStudentId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX IF NOT EXISTS "promo_codes_usedByStudentId_idx" ON "promo_codes"("usedByStudentId");
CREATE INDEX IF NOT EXISTS "promo_codes_createdById_idx" ON "promo_codes"("createdById");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_codes_usedByStudentId_fkey') THEN
    ALTER TABLE "promo_codes"
      ADD CONSTRAINT "promo_codes_usedByStudentId_fkey"
      FOREIGN KEY ("usedByStudentId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_codes_createdById_fkey') THEN
    ALTER TABLE "promo_codes"
      ADD CONSTRAINT "promo_codes_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
