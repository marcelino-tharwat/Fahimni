import { z } from "zod";

const pageLimit = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const listAdminWithdrawalsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["PENDING", "PROCESSING", "TRANSFERRED", "REJECTED", "CANCELLED"]).optional(),
  teacherId: z.string().uuid().optional(),
  ...pageLimit,
});
export type ListAdminWithdrawalsQuery = z.infer<typeof listAdminWithdrawalsQuerySchema>;

// Accepts the FULL status enum (not just the 3 admin-intended targets) so a
// disallowed target (e.g. "PENDING") reaches the service layer's transition
// guard, which reports the precise required error code (step-back vs generic
// invalid) — a stricter zod enum would only produce a generic 400 and never
// exercise that business rule.
export const updateWithdrawalStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "TRANSFERRED", "REJECTED", "CANCELLED"]),
  adminNote: z.string().trim().max(1000).optional(),
});
export type UpdateWithdrawalStatusInput = z.infer<typeof updateWithdrawalStatusSchema>;

export const teacherSummaryQuerySchema = z.object({
  teacherId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export type TeacherSummaryQuery = z.infer<typeof teacherSummaryQuerySchema>;
