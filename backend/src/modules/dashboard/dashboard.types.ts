/**
 * Teacher dashboard statistics contract (STORY-29).
 *
 * Naming note: this Express/Prisma codebase uses `*.types.ts` for response
 * DTOs (see stage.types.ts, chapter.types.ts), so the brief's Nest-style
 * `dto/dashboard-stats.dto.ts` is realized here as `dashboard.types.ts`.
 */

/**
 * A single activity-feed entry. Structured data only — the frontend composes
 * localized display text from `action` + `entityType` + `actorName` + safe
 * `metadata`, so no English sentences are stored or returned.
 */
export interface RecentActivityDTO {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorType: string | null;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TeacherDashboardStatsDTO {
  totalStages: number;
  totalChapters: number;
  totalLessons: number;
  totalStudents: number;
  totalQuizzes: number;
  recentActivity: RecentActivityDTO[];
}

/** STORY-66 — a single student's engagement record. */
export interface StudentEngagementDTO {
  studentId: string;
  studentName: string;
  studentPhone: string | null;
  status: "active" | "inactive";
  enrolledChapterCount: number;
  lessonsWatched: number;
  totalLessons: number;
  averageQuizScore: number | null;
  lastActivityAt: string | null;
  enrollmentMonths: number;
}

/**
 * Engagement summary over the teacher's full, unpaginated roster (G9/G10).
 * `averageEngagement` is a 50/50 blend of lesson-progress % and quiz-average %,
 * rounded to 1 decimal.
 */
export interface EngagementSummaryDTO {
  totalStudents: number;
  activeCount: number;
  inactiveCount: number;
  averageEngagement: number;
}

/** STORY-66 — paginated engagement page. */
export interface StudentEngagementPageDTO {
  summary: EngagementSummaryDTO;
  students: StudentEngagementDTO[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** STORY-75 — one chapter entry for the detail-page filter dropdown (G6). */
export interface StudentDetailChapterDTO {
  chapterId: string;
  name: string;
}

/** STORY-75 — one row in the per-lesson activity table. */
export interface StudentDetailLessonDTO {
  lessonId: string;
  lessonTitle: string;
  chapterId: string;
  chapterName: string;
  /** From LessonProgress.completed (coalesced to false). */
  videoWatched: boolean;
  /** True if the student downloaded ANY material of this lesson. */
  pdfDownloaded: boolean;
  /** From LessonProgress.updatedAt (ISO-8601), null when no progress row. */
  lastViewedAt: string | null;
}

/** STORY-75 — one row in the unified quiz section (chapter + lesson quizzes). */
export interface StudentDetailQuizDTO {
  quizId: string;
  quizTitle: string;
  scopeType: "chapter" | "lesson";
  /** Chapter name, or "درس: <lessonTitle>" for SELECTED_LESSONS quizzes. */
  scopeName: string;
  /** Percentage rounded 2dp; null if no attempt or not graded. */
  score: number | null;
  status: "not_started" | "in_progress" | "completed" | "graded";
  /** QuizAttempt.completedAt (ISO-8601); null if not submitted. */
  submittedAt: string | null;
}

/** STORY-75 (G1/G6) — teacher-facing single-student engagement detail. */
export interface TeacherStudentDetailResponse {
  student: {
    studentId: string;
    fullName: string;
    email: string;
    phone: string | null;
    status: "active" | "inactive";
    enrollmentMonths: number;
  };
  summary: {
    lastActivityAt: string | null;
    averageQuizScore: number | null;
    lessonsWatched: number;
    totalLessons: number;
    enrolledChapterCount: number;
  };
  chapters: StudentDetailChapterDTO[];
  lessons: StudentDetailLessonDTO[];
  quizzes: StudentDetailQuizDTO[];
  /** Paginates the `lessons` array only. */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
