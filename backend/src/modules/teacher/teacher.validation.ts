import { z } from "zod";
import {
  AI_TUTOR_LIMIT_MIN,
  AI_TUTOR_LIMIT_MAX,
} from "../ai/tutor/tutor.constants.js";
import { SUBJECT_CATALOG } from "../subjects/subjects.js";

const VALID_SUBJECT_NAMES = SUBJECT_CATALOG.map((s) => s.displayName) as [
  string,
  ...string[],
];

export const updateTeacherProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, "Full name must be at least 3 characters")
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
        // Match the format registration accepts and stores — both the local
        // "01…" form and the international "+20…" form (prefixes 10/11/12/15).
        // A stricter "^01[0-9]{9}$" rejected teachers whose stored mobile is "+20…".
        /^(\+20|0)(10|11|12|15)[0-9]{8}$/,
        "Mobile number must be a valid Egyptian number (e.g. 01012345678)",
      )
      .optional(),
    subject: z.enum(VALID_SUBJECT_NAMES, { message: "Invalid subject" }).optional(),
    // Whitespace-only ("   ", "\n\t") normalizes away to "no bio" instead of
    // being persisted as a blank/whitespace string.
    bio: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().max(500, "Bio must not exceed 500 characters").optional(),
    ),
    photoUrl: z.string().optional(),
    logoUrl: z.string().optional(),
    aiTutorDailyQueryLimit: z
      .number({ message: "Daily query limit must be a number" })
      .int("Daily query limit must be an integer")
      .min(AI_TUTOR_LIMIT_MIN, `Daily query limit must be at least ${AI_TUTOR_LIMIT_MIN}`)
      .max(AI_TUTOR_LIMIT_MAX, `Daily query limit must not exceed ${AI_TUTOR_LIMIT_MAX}`)
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type UpdateTeacherProfileInput = z.infer<
  typeof updateTeacherProfileSchema
>;
