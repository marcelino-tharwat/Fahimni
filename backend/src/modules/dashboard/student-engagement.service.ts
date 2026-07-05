import { prisma } from "../../config/database.js";
import type {
  EngagementSummaryDTO,
  StudentEngagementDTO,
  StudentEngagementPageDTO,
} from "./dashboard.types.js";
import type { StudentEngagementQuery } from "./student-engagement.validation.js";

/** A student is "active" when their last activity is within this many days. */
const ACTIVE_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Allowlisted ORDER BY fragments — never built from client text. */
const SORT_COLUMNS: Record<StudentEngagementQuery["sortBy"], string> = {
  name: 'u."fullName"',
  lastActivity: '"lastActivityAt"',
  averageQuizScore: '"averageQuizScore"',
};

/** Raw row shape returned by the page query (pre Node post-processing). */
interface EngagementRow {
  studentId: string;
  studentName: string;
  studentPhone: string | null;
  enrolledChapterCount: number;
  lessonsWatched: number;
  totalLessons: number;
  averageQuizScore: number | null;
  lastActivityAt: Date | null;
  firstEnroll: Date;
}

/** Aggregate summary row (one row) returned by the roster summary query. */
interface SummaryRow {
  totalStudents: number;
  activeCount: number;
  avgEngagement: number;
}

/**
 * Teacher-scoped CTE shared by the page and count queries. One row per student
 * (GROUP BY) so downstream joins never multiply rows. Every metric stays inside
 * the teacher's ownership chain (Stage.teacherId → Chapter → Lesson/Quiz).
 *   $1 = teacherId
 */
const BASE_CTE = `
  WITH ts AS (
    SELECT e."studentId" AS sid,
           COUNT(DISTINCT e."chapterId")::int AS chapters,
           MAX(e."enrolledAt") AS last_enroll,
           MIN(e."enrolledAt") AS first_enroll
    FROM "enrollments" e
    JOIN "chapters" c ON c."id" = e."chapterId" AND c."deletedAt" IS NULL
    JOIN "stages" s ON s."id" = c."stageId" AND s."deletedAt" IS NULL
    WHERE s."teacherId" = $1 AND e."status" = 'ACTIVE'
    GROUP BY e."studentId"
  ),
  lp AS (
    SELECT lp."studentId" AS sid,
           COUNT(DISTINCT lp."lessonId") FILTER (WHERE lp."completed")::int AS watched,
           MAX(lp."updatedAt") AS last_view
    FROM "lesson_progress" lp
    JOIN "lessons" l ON l."id" = lp."lessonId" AND l."deletedAt" IS NULL
    JOIN "chapters" c ON c."id" = l."chapterId" AND c."deletedAt" IS NULL
    JOIN "stages" s ON s."id" = c."stageId" AND s."deletedAt" IS NULL
    WHERE s."teacherId" = $1
    GROUP BY lp."studentId"
  ),
  qa AS (
    SELECT qa."studentId" AS sid,
           AVG((qa."score" / NULLIF(qa."totalPoints", 0)) * 100)
             FILTER (WHERE qa."status" = 'GRADED' AND qa."score" IS NOT NULL AND qa."totalPoints" > 0) AS avg_pct,
           MAX(qa."updatedAt") AS last_attempt
    FROM "quiz_attempts" qa
    JOIN "quizzes" qz ON qz."id" = qa."quizId"
    JOIN "chapters" c ON c."id" = qz."chapterId" AND c."deletedAt" IS NULL
    JOIN "stages" s ON s."id" = c."stageId" AND s."deletedAt" IS NULL
    WHERE s."teacherId" = $1
    GROUP BY qa."studentId"
  ),
  lg AS (
    SELECT rt."userId" AS sid, MAX(rt."createdAt") AS last_login
    FROM "refresh_tokens" rt
    GROUP BY rt."userId"
  ),
  tl AS (
    SELECT e."studentId" AS sid,
           COUNT(DISTINCT l."id")::int AS total_lessons
    FROM "lessons" l
    JOIN "chapters" c ON c."id" = l."chapterId" AND c."deletedAt" IS NULL
    JOIN "enrollments" e ON e."chapterId" = c."id" AND e."status" = 'ACTIVE'
    JOIN "stages" s ON s."id" = c."stageId" AND s."deletedAt" IS NULL
    WHERE l."deletedAt" IS NULL AND s."teacherId" = $1
    GROUP BY e."studentId"
  )
`;

/**
 * STORY-66 — teacher student-engagement aggregation.
 *
 * Returns the authenticated teacher's distinct enrolled students with computed
 * status, engagement metrics, and last activity. Search/sort/pagination run in
 * PostgreSQL; counts are pre-aggregated per student in CTEs (no N+1, no join
 * fan-out). Exactly two bounded queries: one page query + one count query.
 */
export class StudentEngagementService {
  public async getTeacherStudents(
    teacherId: string,
    query: StudentEngagementQuery,
    now: Date = new Date(),
  ): Promise<StudentEngagementPageDTO> {
    const { page, limit, search, sortBy, sortOrder } = query;
    const offset = (page - 1) * limit;
    const pattern = this.toLikePattern(search);

    const direction = sortOrder === "asc" ? "ASC" : "DESC";
    // Allowlisted column + fixed direction + NULLS LAST + deterministic tiebreak.
    const orderBy = `${SORT_COLUMNS[sortBy]} ${direction} NULLS LAST, u."id" ASC`;

    const pageSql = `
      ${BASE_CTE}
      SELECT u."id" AS "studentId",
             u."fullName" AS "studentName",
             u."mobile" AS "studentPhone",
             ts.chapters AS "enrolledChapterCount",
             COALESCE(lp.watched, 0) AS "lessonsWatched",
             COALESCE(tl.total_lessons, 0) AS "totalLessons",
             ROUND(qa.avg_pct::numeric, 2)::float8 AS "averageQuizScore",
             GREATEST(lg.last_login, qa.last_attempt, lp.last_view) AS "lastActivityAt",
             ts.first_enroll AS "firstEnroll"
      FROM ts
      JOIN "User" u ON u."id" = ts.sid
      LEFT JOIN lp ON lp.sid = ts.sid
      LEFT JOIN qa ON qa.sid = ts.sid
      LEFT JOIN lg ON lg.sid = ts.sid
      LEFT JOIN tl ON tl.sid = ts.sid
      WHERE ($2::text IS NULL OR u."fullName" ILIKE $2 ESCAPE '\\')
      ORDER BY ${orderBy}
      LIMIT $3 OFFSET $4
    `;

    const countSql = `
      ${BASE_CTE}
      SELECT COUNT(*)::int AS total
      FROM ts
      JOIN "User" u ON u."id" = ts.sid
      WHERE ($2::text IS NULL OR u."fullName" ILIKE $2 ESCAPE '\\')
    `;

    const [rows, countRows, summary] = await Promise.all([
      prisma.$queryRawUnsafe<EngagementRow[]>(pageSql, teacherId, pattern, limit, offset),
      prisma.$queryRawUnsafe<Array<{ total: number }>>(countSql, teacherId, pattern),
      this.getSummary(teacherId, now),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const students = rows.map((r) => this.toDTO(r, now));

    return {
      summary,
      students,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  /**
   * Engagement summary over the teacher's **full, unpaginated, unfiltered**
   * roster (G9/G10). Computed as a single aggregate query: one roster row per
   * student, then COUNT/AVG in SQL.
   *
   * `activeCount` uses the same 7-day activity window as {@link computeStatus};
   * the cutoff is passed as a bound parameter ($2) so it stays consistent with
   * the server-computed `now` (a client timezone cannot shift it).
   *
   * `averageEngagement` is a 50/50 blend of lesson-progress % and quiz-average %
   * per student, averaged across the roster, rounded to 1 decimal. Zero students
   * yields an all-zero summary.
   */
  public async getSummary(
    teacherId: string,
    now: Date = new Date(),
  ): Promise<EngagementSummaryDTO> {
    const cutoff = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);

    const summarySql = `
      ${BASE_CTE}
      , roster AS (
        SELECT ts.sid AS sid,
               GREATEST(lg.last_login, qa.last_attempt, lp.last_view) AS last_activity,
               COALESCE(lp.watched, 0) AS watched,
               COALESCE(tl.total_lessons, 0) AS total_lessons,
               qa.avg_pct AS avg_pct
        FROM ts
        LEFT JOIN lp ON lp.sid = ts.sid
        LEFT JOIN qa ON qa.sid = ts.sid
        LEFT JOIN lg ON lg.sid = ts.sid
        LEFT JOIN tl ON tl.sid = ts.sid
      )
      SELECT COUNT(*)::int AS "totalStudents",
             COUNT(*) FILTER (WHERE last_activity >= $2)::int AS "activeCount",
             COALESCE(
               AVG(
                 0.5 * (CASE WHEN total_lessons > 0
                             THEN watched::float8 / total_lessons * 100
                             ELSE 0 END)
                 + 0.5 * COALESCE(avg_pct, 0)
               ),
               0
             )::float8 AS "avgEngagement"
      FROM roster
    `;

    const rows = await prisma.$queryRawUnsafe<SummaryRow[]>(
      summarySql,
      teacherId,
      cutoff,
    );

    const totalStudents = Number(rows[0]?.totalStudents ?? 0);
    const activeCount = Number(rows[0]?.activeCount ?? 0);
    const averageEngagement =
      totalStudents === 0
        ? 0
        : Math.round(Number(rows[0]?.avgEngagement ?? 0) * 10) / 10;

    return {
      totalStudents,
      activeCount,
      inactiveCount: totalStudents - activeCount,
      averageEngagement,
    };
  }

  /** Build an escaped ILIKE pattern, or null when there is no search term. */
  private toLikePattern(search: string | undefined): string | null {
    const term = (search ?? "").trim();
    if (term.length === 0) return null;
    // Escape LIKE metacharacters so user input is matched literally.
    const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    return `%${escaped}%`;
  }

  private toDTO(row: EngagementRow, now: Date): StudentEngagementDTO {
    return {
      studentId: row.studentId,
      studentName: row.studentName,
      studentPhone: row.studentPhone,
      status: computeStatus(row.lastActivityAt, now),
      enrolledChapterCount: Number(row.enrolledChapterCount),
      lessonsWatched: Number(row.lessonsWatched),
      totalLessons: Number(row.totalLessons),
      averageQuizScore:
        row.averageQuizScore === null ? null : Number(row.averageQuizScore),
      lastActivityAt: row.lastActivityAt
        ? new Date(row.lastActivityAt).toISOString()
        : null,
      enrollmentMonths: completedMonths(row.firstEnroll, now),
    };
  }
}

/**
 * Active when the student's last activity is within the last 7 days (inclusive
 * of the boundary). A `null` last-activity (never active) is always inactive.
 * Cutoff is server-computed, so a client's timezone cannot shift it.
 */
export function computeStatus(
  lastActivityAt: Date | null,
  now: Date = new Date(),
): "active" | "inactive" {
  if (lastActivityAt === null) return "inactive";
  const cutoff = now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS;
  return new Date(lastActivityAt).getTime() >= cutoff ? "active" : "inactive";
}

/**
 * Completed whole calendar months between the earliest enrollment and now
 * (UTC). A partial month counts as 0; never negative.
 */
export function completedMonths(from: Date, now: Date = new Date()): number {
  const f = new Date(from);
  let months =
    (now.getUTCFullYear() - f.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - f.getUTCMonth());
  if (now.getUTCDate() < f.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export const studentEngagementService = new StudentEngagementService();
