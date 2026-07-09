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

const roleSchema = z.enum(["ADMIN", "STUDENT", "OPERATION"]);
const statusSchema = z.enum(["ACTIVE", "INACTIVE", "BANNED"]);
const teacherApprovalSchema = z.enum(["NONE", "PENDING_REVIEW", "APPROVED", "REJECTED"]);

export const adminCreateUserSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  mobile: z.string().trim().regex(/^01[0-9]{9}$/, "Mobile must be a valid Egyptian number"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  role: roleSchema.default("STUDENT"),
  status: statusSchema.default("ACTIVE"),
  teacherApprovalState: teacherApprovalSchema.default("NONE"),
  studentProfile: z
    .object({
      stageId: z.string().uuid().optional(),
    })
    .optional(),
  teacherProfile: z
    .object({
      subject: z.string().trim().max(200).optional(),
      bio: z.string().trim().max(1000).optional(),
    })
    .optional(),
});
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

export const adminUpdateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    mobile: z.string().trim().regex(/^01[0-9]{9}$/, "Invalid mobile number").optional(),
    studentProfile: z
      .object({
        stageId: z.string().uuid().optional(),
      })
      .optional(),
    teacherProfile: z
      .object({
        subject: z.string().trim().max(200).optional(),
        bio: z.string().trim().max(1000).optional(),
        photoUrl: z.string().url().optional().nullable(),
        logoUrl: z.string().url().optional().nullable(),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export const adminChangeStatusSchema = z.object({
  status: statusSchema,
  reason: z.string().trim().min(1, "Reason is required").optional(),
});
export type AdminChangeStatusInput = z.infer<typeof adminChangeStatusSchema>;

export const adminChangeRoleSchema = z.object({
  role: roleSchema,
  reason: z.string().trim().max(500).optional(),
});
export type AdminChangeRoleInput = z.infer<typeof adminChangeRoleSchema>;
