import { z } from "zod";

const pageLimit = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

// Accept YYYY-MM-DD or full ISO; coerce to Date. Invalid strings are rejected.
const dateParam = z.coerce.date().optional();

export const revenueRankingQuerySchema = z.object({
  ...pageLimit,
});

export const listCoursePaymentsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
  teacherId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  dateFrom: dateParam,
  dateTo: dateParam,
  ...pageLimit,
});

export const listSubscriptionPaymentsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
  teacherId: z.string().uuid().optional(),
  dateFrom: dateParam,
  dateTo: dateParam,
  ...pageLimit,
});

export type RevenueRankingQuery = z.infer<typeof revenueRankingQuerySchema>;
export type ListCoursePaymentsQuery = z.infer<typeof listCoursePaymentsQuerySchema>;
export type ListSubscriptionPaymentsQuery = z.infer<typeof listSubscriptionPaymentsQuerySchema>;
