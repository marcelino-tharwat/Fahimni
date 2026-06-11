import { z } from "zod";

export const updateTeacherProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must not exceed 100 characters")
      .optional(),
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .toLowerCase()
      .optional(),
    mobile: z
      .string()
      .trim()
      .regex(
        /^01[0-9]{9}$/,
        "Mobile number must be a valid Egyptian number (e.g. 01012345678)",
      )
      .optional(),
    subject: z.string().trim().optional(),
    bio: z
      .string()
      .trim()
      .max(500, "Bio must not exceed 500 characters")
      .optional(),
    photoUrl: z.string().optional(),
    logoUrl: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type UpdateTeacherProfileInput = z.infer<
  typeof updateTeacherProfileSchema
>;
