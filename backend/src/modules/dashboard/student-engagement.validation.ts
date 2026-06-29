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
