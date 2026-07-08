import { z } from "zod";

/** Students tab query: free-text search + pagination. */
export const teacherStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
});
export type TeacherStudentsQuery = z.infer<typeof teacherStudentsQuerySchema>;

/** Enrollments tab query: status filter + pagination. */
export const teacherEnrollmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "DEACTIVATED", "PAYMENT_PENDING"]).optional(),
});
export type TeacherEnrollmentsQuery = z.infer<typeof teacherEnrollmentsQuerySchema>;
