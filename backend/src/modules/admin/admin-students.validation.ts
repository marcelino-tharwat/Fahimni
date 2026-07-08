import { z } from "zod";

export const studentFilterSchema = z
  .enum(["all", "active", "without_enrollment", "without_active_teacher", "payment_pending"])
  .default("all");

export const studentSortBySchema = z
  .enum(["createdAt", "fullName", "email", "status"])
  .default("createdAt");

/** GET /api/admin/students query. */
export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]).optional(),
  filter: studentFilterSchema,
  sortBy: studentSortBySchema,
  sort: z.enum(["asc", "desc"]).default("desc"),
});
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

/** GET /api/admin/students/:studentId/enrollments query. */
export const studentEnrollmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "DEACTIVATED", "PAYMENT_PENDING"]).optional(),
});
export type StudentEnrollmentsQuery = z.infer<typeof studentEnrollmentsQuerySchema>;
