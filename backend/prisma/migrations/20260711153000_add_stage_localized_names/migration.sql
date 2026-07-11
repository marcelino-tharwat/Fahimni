ALTER TABLE "stages"
ADD COLUMN IF NOT EXISTS "nameAr" TEXT,
ADD COLUMN IF NOT EXISTS "nameEn" TEXT,
ADD COLUMN IF NOT EXISTS "descriptionAr" TEXT,
ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;

UPDATE "stages"
SET
  "nameAr" = COALESCE("nameAr", "name"),
  "nameEn" = COALESCE("nameEn", "name"),
  "descriptionAr" = COALESCE("descriptionAr", "description"),
  "descriptionEn" = COALESCE("descriptionEn", "description")
WHERE "deletedAt" IS NULL;
