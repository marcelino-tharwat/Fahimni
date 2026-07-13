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

/** PATCH /api/admin/students/:studentId body. */
export const updateStudentBodySchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100).optional(),
    email: z.string().trim().email("Invalid email address").toLowerCase().optional(),
    mobile: z
      .string()
      .trim()
      .regex(/^01[0-9]{9}$/, "Mobile must be a valid Egyptian number")
      .optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    stageId: z.string().uuid("Invalid stage ID").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });
export type UpdateStudentBody = z.infer<typeof updateStudentBodySchema>;
