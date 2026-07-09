import { z } from "zod";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "STUDENT", "OPERATION"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]).optional(),
  teacherApprovalState: z
    .enum(["NONE", "PENDING_REVIEW", "APPROVED", "REJECTED"])
    .optional(),
  sortBy: z
    .enum(["createdAt", "fullName", "email", "status", "role"])
    .default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
