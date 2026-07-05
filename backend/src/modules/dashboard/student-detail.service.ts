import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { computeStatus, completedMonths } from "./student-engagement.service.js";
import type {
  StudentDetailChapterDTO,
  StudentDetailLessonDTO,
  StudentDetailQuizDTO,
  TeacherStudentDetailResponse,
} from "./dashboard.types.js";
import type { TeacherStudentDetailQuery } from "./student-engagement.validation.js";

/** One row returned by the per-student aggregate query (exactly one row). */
interface StudentAggregateRow {
  lessonsWatched: number;
  totalLessons: number;
  averageQuizScore: number | null;
  lastActivityAt: Date | null;
}

/** Map a raw QuizAttempt.status to the DTO's lowercased status. */
function toQuizStatus(
  attemptStatus: string | undefined,
): StudentDetailQuizDTO["status"] {
  if (!attemptStatus) return "not_started";
  return attemptStatus.toLowerCase() as StudentDetailQuizDTO["status"];
}

/** Percentage rounded to 2dp, or null when the attempt is missing/ungraded. */
function toScorePercent(
  attempt: { score: number | null; totalPoints: number } | undefined,
): number | null {
  if (!attempt || attempt.score === null || attempt.totalPoints <= 0) {
    return null;
  }
  return Math.round((attempt.score / attempt.totalPoints) * 100 * 100) / 100;
}

/**
 * STORY-75 (G1/G6) — teacher-facing single-student engagement detail.
 *
 * Ownership: the student must have at least one ACTIVE enrollment in a chapter
 * belonging to a stage the caller owns. If not, a 404 is thrown (never 403), so
 * foreign ids are indistinguishable from non-existent ones.
 *
 * Reuses {@link computeStatus} and {@link completedMonths} from the list
 * service. The per-student aggregate (lastActivityAt / averageQuizScore /
 * lessonsWatched / totalLessons) mirrors the list service's CTEs but is scoped
 * to a single student, so it is expressed as a focused single-row query here.
 */
export class StudentDetailService {
  public async getStudentDetail(
    teacherId: string,
    studentId: string,
    query: TeacherStudentDetailQuery,
    now: Date = new Date(),
  ): Promise<TeacherStudentDetailResponse> {
    const { page, pageSize } = query;

    // 1. Ownership + chapter filter list (G6). Distinct chapters the student is
    //    ACTIVELY enrolled in within the caller's stages, ordered for the UI.
    const enrolledChapters = await prisma.chapter.findMany({
      where: {
        deletedAt: null,
        stage: { teacherId, deletedAt: null },
        enrollments: { some: { studentId, status: "ACTIVE" } },
      },
      select: { id: true, name: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });

    if (enrolledChapters.length === 0) {
      throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
    }

    const enrolledChapterIds = enrolledChapters.map((c) => c.id);
    const enrolledChapterIdSet = new Set(enrolledChapterIds);

    // A chapterId filter must reference one of the student's enrolled chapters.
    if (query.chapterId && !enrolledChapterIdSet.has(query.chapterId)) {
      throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
    }

    const lessonChapterIds = query.chapterId
      ? [query.chapterId]
      : enrolledChapterIds;

    // 2. Everything else is independent of the chapter list above — fan out.
    const [student, firstEnrollAgg, aggRows, lessonsTotal, lessonRows, quizRows] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: studentId },
          select: { fullName: true, email: true, mobile: true },
        }),
        prisma.enrollment.aggregate({
          where: {
            studentId,
            status: "ACTIVE",
            chapter: { deletedAt: null, stage: { teacherId, deletedAt: null } },
          },
          _min: { enrolledAt: true },
        }),
        this.getStudentAggregate(teacherId, studentId),
        prisma.lesson.count({
          where: { deletedAt: null, chapterId: { in: lessonChapterIds } },
        }),
        prisma.lesson.findMany({
          where: { deletedAt: null, chapterId: { in: lessonChapterIds } },
          select: {
            id: true,
            title: true,
            chapterId: true,
            chapter: { select: { name: true } },
            lessonProgress: {
              where: { studentId },
              select: { completed: true, updatedAt: true },
            },
          },
          orderBy: [{ chapter: { sortOrder: "asc" } }, { sortOrder: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.quiz.findMany({
          where: {
            status: "PUBLISHED",
            OR: [
              { contentScope: "CHAPTER", chapterId: { in: enrolledChapterIds } },
              {
                contentScope: "SELECTED_LESSONS",
                quizLessons: {
                  some: {
                    lesson: {
                      chapterId: { in: enrolledChapterIds },
                      deletedAt: null,
                    },
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            title: true,
            contentScope: true,
            chapter: { select: { name: true, sortOrder: true } },
            quizLessons: {
              select: {
                lesson: {
                  select: {
                    id: true,
                    title: true,
                    sortOrder: true,
                    chapterId: true,
                  },
                },
              },
            },
            attempts: {
              where: { studentId },
              select: {
                score: true,
                totalPoints: true,
                status: true,
                completedAt: true,
              },
            },
          },
        }),
      ]);

    if (!student) {
      // Ownership already proved enrollments exist, so this is defensive only.
      throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
    }

    // 3. pdfDownloaded: a lesson counts if the student downloaded ANY of its
    //    materials. Scoped to the current lessons page.
    const pageLessonIds = lessonRows.map((l) => l.id);
    const downloadedRows =
      pageLessonIds.length === 0
        ? []
        : await prisma.lessonMaterial.findMany({
            where: {
              lessonId: { in: pageLessonIds },
              deletedAt: null,
              downloads: { some: { studentId } },
            },
            select: { lessonId: true },
            distinct: ["lessonId"],
          });
    const downloadedLessonIds = new Set(downloadedRows.map((m) => m.lessonId));

    const agg = aggRows[0];
    const lastActivityDate = agg?.lastActivityAt ?? null;
    const firstEnroll = firstEnrollAgg._min.enrolledAt;

    const chapters: StudentDetailChapterDTO[] = enrolledChapters.map((c) => ({
      chapterId: c.id,
      name: c.name,
    }));

    const lessons: StudentDetailLessonDTO[] = lessonRows.map((l) => {
      const progress = l.lessonProgress[0];
      return {
        lessonId: l.id,
        lessonTitle: l.title,
        chapterId: l.chapterId,
        chapterName: l.chapter.name,
        videoWatched: progress?.completed ?? false,
        pdfDownloaded: downloadedLessonIds.has(l.id),
        lastViewedAt: progress?.updatedAt
          ? progress.updatedAt.toISOString()
          : null,
      };
    });

    const quizzes = this.buildQuizzes(quizRows, enrolledChapterIdSet);

    const totalPages =
      lessonsTotal === 0 ? 0 : Math.ceil(lessonsTotal / pageSize);

    return {
      student: {
        studentId,
        fullName: student.fullName,
        email: student.email,
        phone: student.mobile,
        status: computeStatus(lastActivityDate, now),
        enrollmentMonths: firstEnroll ? completedMonths(firstEnroll, now) : 0,
      },
      summary: {
        lastActivityAt: lastActivityDate
          ? lastActivityDate.toISOString()
          : null,
        averageQuizScore: agg?.averageQuizScore ?? null,
        lessonsWatched: Number(agg?.lessonsWatched ?? 0),
        totalLessons: Number(agg?.totalLessons ?? 0),
        enrolledChapterCount: enrolledChapters.length,
      },
      chapters,
      lessons,
      quizzes,
      pagination: {
        page,
        pageSize,
        total: lessonsTotal,
        totalPages,
      },
    };
  }

  /**
   * Per-student engagement aggregate scoped to the caller's ownership chain.
   * Each CTE is a single aggregate (no GROUP BY) so the cross join yields
   * exactly one row. Mirrors the list service's lp/qa/tl/lg CTEs.
   *   $1 = teacherId, $2 = studentId
   */
  private async getStudentAggregate(
    teacherId: string,
    studentId: string,
  ): Promise<StudentAggregateRow[]> {
    const sql = `
      WITH lp AS (
        SELECT COUNT(DISTINCT lp."lessonId") FILTER (WHERE lp."completed")::int AS watched,
               MAX(lp."updatedAt") AS last_view
        FROM "lesson_progress" lp
        JOIN "lessons" l ON l."id" = lp."lessonId" AND l."deletedAt" IS NULL
        JOIN "chapters" c ON c."id" = l."chapterId" AND c."deletedAt" IS NULL
        JOIN "stages" s ON s."id" = c."stageId" AND s."deletedAt" IS NULL
        WHERE s."teacherId" = $1 AND lp."studentId" = $2
      ),
      qa AS (
        SELECT AVG((qa."score" / NULLIF(qa."totalPoints", 0)) * 100)
                 FILTER (WHERE qa."status" = 'GRADED' AND qa."score" IS NOT NULL AND qa."totalPoints" > 0) AS avg_pct,
               MAX(qa."updatedAt") AS last_attempt
        FROM "quiz_attempts" qa
        JOIN "quizzes" qz ON qz."id" = qa."quizId"
        JOIN "chapters" c ON c."id" = qz."chapterId" AND c."deletedAt" IS NULL
        JOIN "stages" s ON s."id" = c."stageId" AND s."deletedAt" IS NULL
        WHERE s."teacherId" = $1 AND qa."studentId" = $2
      ),
      tl AS (
        SELECT COUNT(DISTINCT l."id")::int AS total_lessons
        FROM "lessons" l
        JOIN "chapters" c ON c."id" = l."chapterId" AND c."deletedAt" IS NULL
        JOIN "enrollments" e ON e."chapterId" = c."id" AND e."status" = 'ACTIVE'
        JOIN "stages" s ON s."id" = c."stageId" AND s."deletedAt" IS NULL
        WHERE l."deletedAt" IS NULL AND s."teacherId" = $1 AND e."studentId" = $2
      ),
      lg AS (
        SELECT MAX(rt."createdAt") AS last_login
        FROM "refresh_tokens" rt
        WHERE rt."userId" = $2
      )
      SELECT COALESCE(lp.watched, 0) AS "lessonsWatched",
             COALESCE(tl.total_lessons, 0) AS "totalLessons",
             ROUND(qa.avg_pct::numeric, 2)::float8 AS "averageQuizScore",
             GREATEST(lg.last_login, qa.last_attempt, lp.last_view) AS "lastActivityAt"
      FROM lp, qa, tl, lg
    `;

    return prisma.$queryRawUnsafe<StudentAggregateRow[]>(sql, teacherId, studentId);
  }

  /**
   * Unified quiz section: chapter quizzes first (by chapter.sortOrder), then
   * lesson quizzes (by the representative lesson's sortOrder). For a
   * SELECTED_LESSONS quiz the representative lesson is the first linked lesson
   * — by lesson.sortOrder — that sits in a chapter the student is enrolled in;
   * if none is, the quiz is skipped (defensive — the query only surfaces
   * quizzes with at least one linked lesson in an enrolled chapter).
   */
  private buildQuizzes(
    quizRows: Array<{
      id: string;
      title: string;
      contentScope: "CHAPTER" | "SELECTED_LESSONS";
      chapter: { name: string; sortOrder: number } | null;
      quizLessons: Array<{
        lesson: {
          id: string;
          title: string;
          sortOrder: number;
          chapterId: string;
        };
      }>;
      attempts: Array<{
        score: number | null;
        totalPoints: number;
        status: string;
        completedAt: Date | null;
      }>;
    }>,
    enrolledChapterIdSet: Set<string>,
  ): StudentDetailQuizDTO[] {
    interface Ranked {
      dto: StudentDetailQuizDTO;
      group: 0 | 1;
      order: number;
    }
    const ranked: Ranked[] = [];

    for (const quiz of quizRows) {
      const attempt = quiz.attempts[0];
      const dtoBase = {
        quizId: quiz.id,
        quizTitle: quiz.title,
        score: toScorePercent(attempt),
        status: toQuizStatus(attempt?.status),
        submittedAt: attempt?.completedAt
          ? attempt.completedAt.toISOString()
          : null,
      };

      if (quiz.contentScope === "CHAPTER") {
        if (!quiz.chapter) continue; // defensive
        ranked.push({
          dto: {
            ...dtoBase,
            scopeType: "chapter",
            scopeName: quiz.chapter.name,
          },
          group: 0,
          order: quiz.chapter.sortOrder,
        });
      } else {
        const rep = quiz.quizLessons
          .map((ql) => ql.lesson)
          .filter((l) => enrolledChapterIdSet.has(l.chapterId))
          .sort((a, b) => a.sortOrder - b.sortOrder)[0];
        if (!rep) continue; // no linked lesson in an enrolled chapter
        ranked.push({
          dto: {
            ...dtoBase,
            scopeType: "lesson",
            scopeName: `درس: ${rep.title}`,
          },
          group: 1,
          order: rep.sortOrder,
        });
      }
    }

    ranked.sort(
      (a, b) =>
        a.group - b.group ||
        a.order - b.order ||
        a.dto.quizId.localeCompare(b.dto.quizId),
    );

    return ranked.map((r) => r.dto);
  }
}

export const studentDetailService = new StudentDetailService();
