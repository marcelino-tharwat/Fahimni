import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "STUDENT", "OPERATION"]);

export const createUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must not exceed 100 characters"),
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must not exceed 72 characters"),
  mobile: z
    .string()
    .trim()
    .regex(
      /^01[0-9]{9}$/,
      "Mobile number must be a valid Egyptian number (e.g. 01012345678)",
    ),
  role: userRoleSchema.default("STUDENT"),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    password: z.string().min(8).max(72).optional(),
    mobile: z
      .string()
      .trim()
      .regex(/^01[0-9]{9}$/, "Invalid mobile number")
      .optional(),
    role: userRoleSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
