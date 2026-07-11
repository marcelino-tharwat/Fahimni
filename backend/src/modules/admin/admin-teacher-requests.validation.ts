import { z } from "zod";

// Whitespace-only ("   ", "\n\t") normalizes away to "no notes" instead of
// being persisted as a blank/whitespace string (this field has no `.min()`).
const optionalAdminNotesField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(2000).optional(),
);

export const listTeacherRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  sortBy: z.enum(["createdAt", "reviewedAt", "fullName", "status"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
});
export type ListTeacherRequestsQuery = z.infer<typeof listTeacherRequestsQuerySchema>;

export const approveRequestSchema = z.object({
  adminNotes: optionalAdminNotesField,
  createAccount: z.boolean().default(true),
});
export type ApproveRequestInput = z.infer<typeof approveRequestSchema>;

export const rejectRequestSchema = z.object({
  adminNotes: z.string().trim().min(1, "Admin notes are required to reject a request").max(2000),
});
export type RejectRequestInput = z.infer<typeof rejectRequestSchema>;
