import { z } from "zod";

/** Max search length — bounds the LIKE pattern and avoids abusive input. */
export const MAX_SEARCH_LENGTH = 100;
/** Default and maximum page size. Default honors STORY-66's "20 per page". */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * STORY-66 — GET /api/dashboard/teacher/students query contract.
 *
 * Validated in the controller via safeParse (Express 5 exposes req.query as a
 * read-only getter, so the shared `validateRequest(..., "query")` cannot
 * reassign it). Unknown keys are stripped, not rejected, matching the project's
 * lenient query handling.
 */
export const studentEngagementQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_PAGE_SIZE)
      .default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
    sortBy: z.enum(["name", "lastActivity", "averageQuizScore"]).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  })
  .strip();

export type StudentEngagementQuery = z.infer<typeof studentEngagementQuerySchema>;

/** UUID (v4-ish) matcher, matching the pattern used across the other modules. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * STORY-75 — path params for GET /api/dashboard/teacher/students/:studentId.
 *
 * IDs in this project are plain strings (uuid in prod, custom slugs in seed
 * data), so we validate non-empty rather than a strict uuid format — matching
 * the existing id validation used across the other modules. A malformed or
 * foreign id simply resolves to a 404 in the service (foreign and non-existent
 * ids are deliberately indistinguishable).
 */
export const teacherStudentDetailParamSchema = z.object({
  studentId: z.string().trim().min(1, "Student ID is required"),
});

export type TeacherStudentDetailParam = z.infer<
  typeof teacherStudentDetailParamSchema
>;

/**
 * STORY-75 — query params for the detail endpoint. `chapterId` filters the
 * lessons array to one chapter; `page`/`pageSize` paginate the lessons only.
 * Validated in the controller via safeParse (Express 5 exposes req.query as a
 * read-only getter). Unknown keys are stripped, matching the list contract.
 */
export const teacherStudentDetailQuerySchema = z
  .object({
    chapterId: z
      .string()
      .trim()
      .regex(UUID_RE, "Chapter ID must be a valid UUID")
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_PAGE_SIZE)
      .default(DEFAULT_PAGE_SIZE),
  })
  .strip();

export type TeacherStudentDetailQuery = z.infer<
  typeof teacherStudentDetailQuerySchema
>;
