-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AiUsageType" AS ENUM ('AI_QUIZ_GENERATION', 'AI_ESSAY_GRADING', 'AI_CONTENT_GENERATION', 'AI_LESSON_SUMMARY', 'AI_QUESTION_EXPLANATION');

-- CreateTable
CREATE TABLE "teacher_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '[]',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_subscriptions" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_subscription_requests" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "requestedInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "status" "SubscriptionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_subscription_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_ai_usage_events" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "planId" TEXT,
    "usageType" "AiUsageType" NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_plans_code_key" ON "teacher_plans"("code");

-- CreateIndex
CREATE INDEX "teacher_plans_isActive_sortOrder_idx" ON "teacher_plans"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "teacher_subscriptions_teacherId_idx" ON "teacher_subscriptions"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_subscriptions_teacherId_status_idx" ON "teacher_subscriptions"("teacherId", "status");

-- CreateIndex
CREATE INDEX "teacher_subscriptions_planId_idx" ON "teacher_subscriptions"("planId");

-- CreateIndex
CREATE INDEX "teacher_subscription_requests_teacherId_idx" ON "teacher_subscription_requests"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_subscription_requests_teacherId_status_idx" ON "teacher_subscription_requests"("teacherId", "status");

-- CreateIndex
CREATE INDEX "teacher_subscription_requests_planId_idx" ON "teacher_subscription_requests"("planId");

-- CreateIndex
CREATE INDEX "teacher_ai_usage_events_teacherId_idx" ON "teacher_ai_usage_events"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_ai_usage_events_teacherId_usageType_createdAt_idx" ON "teacher_ai_usage_events"("teacherId", "usageType", "createdAt");

-- CreateIndex
CREATE INDEX "teacher_ai_usage_events_subscriptionId_idx" ON "teacher_ai_usage_events"("subscriptionId");

-- CreateIndex
CREATE INDEX "teacher_ai_usage_events_planId_idx" ON "teacher_ai_usage_events"("planId");

-- AddForeignKey
ALTER TABLE "teacher_subscriptions" ADD CONSTRAINT "teacher_subscriptions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subscriptions" ADD CONSTRAINT "teacher_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "teacher_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subscription_requests" ADD CONSTRAINT "teacher_subscription_requests_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subscription_requests" ADD CONSTRAINT "teacher_subscription_requests_planId_fkey" FOREIGN KEY ("planId") REFERENCES "teacher_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_ai_usage_events" ADD CONSTRAINT "teacher_ai_usage_events_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_ai_usage_events" ADD CONSTRAINT "teacher_ai_usage_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "teacher_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_ai_usage_events" ADD CONSTRAINT "teacher_ai_usage_events_planId_fkey" FOREIGN KEY ("planId") REFERENCES "teacher_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
