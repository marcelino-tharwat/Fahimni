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
  totalLessonsWatched: number;
  averageQuizScore: number | null;
  lastActivityAt: string | null;
  enrollmentMonths: number;
}

/** STORY-66 — paginated engagement page. */
export interface StudentEngagementPageDTO {
  students: StudentEngagementDTO[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
