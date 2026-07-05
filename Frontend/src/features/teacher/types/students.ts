/**
 * Teacher Student Engagement — list contract (STORY-74).
 *
 * Mirrors the backend `StudentEngagementPageDTO`
 * (backend/src/modules/dashboard/dashboard.types.ts) returned by
 *   GET /api/dashboard/teacher/students
 * exactly: same field names, same nullability.
 */

export type TeacherStudentStatus = 'active' | 'inactive';
export type TeacherStudentsSortBy = 'name' | 'lastActivity' | 'averageQuizScore';
export type TeacherStudentsSortOrder = 'asc' | 'desc';

/** Engagement totals over the teacher's full (unpaginated) roster. */
export interface TeacherStudentsSummary {
  totalStudents: number;
  activeCount: number;
  inactiveCount: number;
  /** 50/50 blend of lesson-progress % and quiz-average %, rounded to 1 decimal. */
  averageEngagement: number;
}

/** A single student's engagement record (one table row). */
export interface TeacherStudentRow {
  studentId: string;
  studentName: string;
  studentPhone: string | null;
  /**
   * Derived from `lastActivityAt`: "active" when the last activity is within the
   * last 7 days (inclusive); a null `lastActivityAt` (never active) is always
   * "inactive". Computed server-side.
   */
  status: TeacherStudentStatus;
  enrolledChapterCount: number;
  lessonsWatched: number;
  totalLessons: number;
  averageQuizScore: number | null;
  /** ISO-8601 timestamp (or null). Needs client-side formatting for display. */
  lastActivityAt: string | null;
  enrollmentMonths: number;
}

export interface TeacherStudentsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TeacherStudentsPageResponse {
  summary: TeacherStudentsSummary;
  students: TeacherStudentRow[];
  pagination: TeacherStudentsPagination;
}

/** Query parameters accepted by GET /api/dashboard/teacher/students. */
export interface TeacherStudentsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: TeacherStudentsSortBy;
  sortOrder?: TeacherStudentsSortOrder;
}
