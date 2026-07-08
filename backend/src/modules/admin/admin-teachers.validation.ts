import { z } from "zod";

/** Whitelisted sort columns — only safe, indexed User scalar fields. */
export const teacherSortBySchema = z
  .enum(["createdAt", "fullName", "email", "status"])
  .default("createdAt");

/**
 * Query schema for GET /api/admin/teachers. Coerces pagination, accepts an
 * optional status filter, a free-text search term (`q`), and a safe sort.
 */
export const listTeachersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]).optional(),
  sortBy: teacherSortBySchema,
  sort: z.enum(["asc", "desc"]).default("desc"),
});

export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>;
