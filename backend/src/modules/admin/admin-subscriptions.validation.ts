import { z } from "zod";

const pageLimit = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const PLAN_CODES = ["FREE", "BASIC", "PRO", "PREMIUM"] as const;

export const listEntitlementsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  planCode: z.string().trim().toUpperCase().pipe(z.enum(PLAN_CODES)).optional(),
  entitlementSource: z.enum(["DEFAULT_FREE_PLAN", "ACTIVE_SUBSCRIPTION"]).optional(),
  ...pageLimit,
});

export const listSubscriptionsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]).optional(),
  planCode: z.string().trim().toUpperCase().pipe(z.enum(PLAN_CODES)).optional(),
  ...pageLimit,
});

export const listPaymentsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
  planCode: z.string().trim().toUpperCase().pipe(z.enum(PLAN_CODES)).optional(),
  ...pageLimit,
});

export const listSubscriptionRequestsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  ...pageLimit,
});

export const listAiUsageQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  usageType: z
    .enum([
      "AI_QUIZ_GENERATION",
      "AI_ESSAY_GRADING",
      "AI_CONTENT_GENERATION",
      "AI_LESSON_SUMMARY",
      "AI_QUESTION_EXPLANATION",
    ])
    .optional(),
  ...pageLimit,
});

export const approveSubscriptionRequestSchema = z.object({
  adminNotes: z.string().trim().max(1000).optional(),
});

export const rejectSubscriptionRequestSchema = z.object({
  adminNotes: z.string().trim().min(1, "A rejection reason is required").max(1000),
});

export type ListEntitlementsQuery = z.infer<typeof listEntitlementsQuerySchema>;
export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type ListSubscriptionRequestsQuery = z.infer<typeof listSubscriptionRequestsQuerySchema>;
export type ListAiUsageQuery = z.infer<typeof listAiUsageQuerySchema>;
export type ApproveSubscriptionRequestInput = z.infer<typeof approveSubscriptionRequestSchema>;
export type RejectSubscriptionRequestInput = z.infer<typeof rejectSubscriptionRequestSchema>;
