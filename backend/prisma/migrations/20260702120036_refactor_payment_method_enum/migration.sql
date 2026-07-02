-- AlterEnum
-- Refactor PaymentMethod: remove the unused CASH and VISA values and add FREE.
--
-- Any rows still holding a retired value are remapped to a valid new value
-- *inside* the column-conversion USING clause, so the change is safe even on
-- databases that already contain CASH / VISA / free-like PROMO rows (a plain
-- ::text::"PaymentMethod_new" cast would fail on those). Mapping:
--   CASH                                   -> FREE   (only ever price:0 grants)
--   VISA                                   -> PAYMOB (legacy paid enrollments)
--   PROMO where price = 0 AND no promoCode -> FREE   (free enrollments created
--                                                     via /enrollments/free before
--                                                     the FREE value existed)
-- Real PROMO redemptions (price > 0 or a promoCodeId) are left as PROMO.
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('FREE', 'PROMO', 'PAYMOB');
ALTER TABLE "enrollments" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING (
  CASE
    WHEN "paymentMethod"::text = 'CASH' THEN 'FREE'
    WHEN "paymentMethod"::text = 'VISA' THEN 'PAYMOB'
    WHEN "paymentMethod"::text = 'PROMO' AND "price" = 0 AND "promoCodeId" IS NULL THEN 'FREE'
    ELSE "paymentMethod"::text
  END::"PaymentMethod_new"
);
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;
