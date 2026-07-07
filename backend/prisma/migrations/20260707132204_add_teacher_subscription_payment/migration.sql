-- CreateTable
CREATE TABLE "teacher_subscription_payments" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'PAYMOB',
    "providerOrderId" TEXT,
    "providerTransactionId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutUrl" TEXT,
    "errorMessage" TEXT,
    "rawCallback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subscription_payments_providerOrderId_key" ON "teacher_subscription_payments"("providerOrderId");

-- CreateIndex
CREATE INDEX "teacher_subscription_payments_teacherId_idx" ON "teacher_subscription_payments"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_subscription_payments_teacherId_status_idx" ON "teacher_subscription_payments"("teacherId", "status");

-- CreateIndex
CREATE INDEX "teacher_subscription_payments_planId_idx" ON "teacher_subscription_payments"("planId");

-- CreateIndex
CREATE INDEX "teacher_subscription_payments_subscriptionId_idx" ON "teacher_subscription_payments"("subscriptionId");

-- AddForeignKey
ALTER TABLE "teacher_subscription_payments" ADD CONSTRAINT "teacher_subscription_payments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subscription_payments" ADD CONSTRAINT "teacher_subscription_payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "teacher_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subscription_payments" ADD CONSTRAINT "teacher_subscription_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "teacher_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
