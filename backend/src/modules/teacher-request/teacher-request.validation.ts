import { z } from "zod";
import { SUBJECT_CATALOG } from "../subjects/subjects.js";

const VALID_SUBJECT_NAMES = SUBJECT_CATALOG.map((s) => s.displayName) as [
  string,
  ...string[],
];

const ALLOWED_PROOF_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const PROOF_MAX_SIZE = 10 * 1024 * 1024;
const PROOF_MAX_COUNT = 5;

export const proofFileSchema = z.object({
  originalName: z.string().trim().min(1),
  mimeType: z.enum(ALLOWED_PROOF_MIME_TYPES),
  size: z.number().int().positive().max(PROOF_MAX_SIZE),
  path: z.string().trim().min(1),
});

export const createTeacherRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must not exceed 100 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .toLowerCase(),
  mobile: z
    .string()
    .trim()
    .regex(
      /^(\+20|0)(10|11|12|15)[0-9]{8}$/,
      "Mobile must be a valid Egyptian number",
    ),
  subject: z
    .enum(VALID_SUBJECT_NAMES, { message: "Invalid subject" })
    .optional(),
  // Whitespace-only ("   ", "\n\t") normalizes away to "no bio" instead of
  // being persisted as a blank/whitespace string.
  bio: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(1000, "Bio must not exceed 1000 characters").optional(),
  ),
});

export type CreateTeacherRequestInput = z.infer<typeof createTeacherRequestSchema>;

// Public status tracking. Requires the public reference PLUS at least one contact
// identifier (email or mobile) so status cannot be enumerated by reference alone.
export const trackTeacherRequestSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(1, "Reference is required")
      .max(40, "Reference is too long"),
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
        /^(\+20|0)(10|11|12|15)[0-9]{8}$/,
        "Mobile must be a valid Egyptian number",
      )
      .optional(),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.mobile), {
    message: "Email or mobile is required",
    path: ["email"],
  });

export type TrackTeacherRequestInput = z.infer<typeof trackTeacherRequestSchema>;

export { ALLOWED_PROOF_MIME_TYPES, PROOF_MAX_SIZE, PROOF_MAX_COUNT };
