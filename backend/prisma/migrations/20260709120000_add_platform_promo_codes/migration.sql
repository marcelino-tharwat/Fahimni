-- CreateEnum
CREATE TYPE "PromoScope" AS ENUM ('COURSE_PURCHASE', 'TEACHER_PLAN');

-- CreateEnum
CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PromoBillingScope" AS ENUM ('MONTHLY', 'YEARLY', 'ALL');


-- CreateTable
CREATE TABLE "platform_promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scope" "PromoScope" NOT NULL,
    "discountType" "PromoDiscountType" NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER,
    "applicablePlanIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "billingInterval" "PromoBillingScope" NOT NULL DEFAULT 'ALL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_promo_redemptions" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountBefore" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "amountAfter" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_promo_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_promo_codes_code_key" ON "platform_promo_codes"("code");

-- CreateIndex
CREATE INDEX "platform_promo_codes_scope_isActive_idx" ON "platform_promo_codes"("scope", "isActive");

-- CreateIndex
CREATE INDEX "platform_promo_redemptions_promoCodeId_idx" ON "platform_promo_redemptions"("promoCodeId");

-- CreateIndex
CREATE INDEX "platform_promo_redemptions_userId_idx" ON "platform_promo_redemptions"("userId");

-- CreateIndex
CREATE INDEX "platform_promo_redemptions_promoCodeId_userId_idx" ON "platform_promo_redemptions"("promoCodeId", "userId");

-- AddForeignKey
ALTER TABLE "platform_promo_codes" ADD CONSTRAINT "platform_promo_codes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_promo_redemptions" ADD CONSTRAINT "platform_promo_redemptions_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "platform_promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_promo_redemptions" ADD CONSTRAINT "platform_promo_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

