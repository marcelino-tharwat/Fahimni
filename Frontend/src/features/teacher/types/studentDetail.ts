/**
 * Teacher Student Detail — contract (STORY-75).
 *
 * Mirrors the backend `TeacherStudentDetailResponse`
 * (backend/src/modules/dashboard/dashboard.types.ts) returned by
 *   GET /api/dashboard/teacher/students/:studentId
 * exactly: same field names, same nullability.
 */

import type { TeacherStudentStatus } from './students';

// Re-export so consumers can pull the status type from the detail module too.
export type { TeacherStudentStatus };

export type TeacherStudentQuizScopeType = 'chapter' | 'lesson';
export type TeacherStudentQuizStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'graded';

export interface TeacherStudentDetailStudent {
  studentId: string;
  fullName: string;
  email: string;
  phone: string | null;
  /**
   * 7-day activity semantics (same rule as the list): "active" when the last
   * activity is within the last 7 days; a null last-activity is always
   * "inactive". Computed server-side.
   */
  status: TeacherStudentStatus;
  enrollmentMonths: number;
}

export interface TeacherStudentDetailSummary {
  /** ISO-8601 timestamp (or null). Needs client-side formatting for display. */
  lastActivityAt: string | null;
  /** Percentage already rounded server-side to 2dp; null when no graded attempts. */
  averageQuizScore: number | null;
  lessonsWatched: number;
  totalLessons: number;
  enrolledChapterCount: number;
}

/** One chapter entry for the filter dropdown. */
export interface TeacherStudentDetailChapter {
  chapterId: string;
  name: string;
}

/** One row in the per-lesson activity table. */
export interface TeacherStudentDetailLesson {
  lessonId: string;
  lessonTitle: string;
  chapterId: string;
  chapterName: string;
  videoWatched: boolean;
  pdfDownloaded: boolean;
  /** ISO-8601 timestamp (or null). Needs client-side formatting for display. */
  lastViewedAt: string | null;
}

/** One row in the unified quiz section (chapter + lesson quizzes). */
export interface TeacherStudentDetailQuiz {
  quizId: string;
  quizTitle: string;
  scopeType: TeacherStudentQuizScopeType;
  scopeName: string;
  /** Percentage 0-100; null if not attempted or not graded. */
  score: number | null;
  status: TeacherStudentQuizStatus;
  /** ISO-8601; null if not submitted (i.e. status is not_started or in_progress). */
  submittedAt: string | null;
}

/** Paginates the `lessons` array only. */
export interface TeacherStudentDetailPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TeacherStudentDetailResponse {
  student: TeacherStudentDetailStudent;
  summary: TeacherStudentDetailSummary;
  chapters: TeacherStudentDetailChapter[];
  lessons: TeacherStudentDetailLesson[];
  quizzes: TeacherStudentDetailQuiz[];
  pagination: TeacherStudentDetailPagination;
}

/** Query parameters accepted by GET /api/dashboard/teacher/students/:studentId. */
export interface TeacherStudentDetailQueryParams {
  /** UUID filter for the lessons array; '' / omitted means all chapters. */
  chapterId?: string;
  page?: number;
  pageSize?: number;
}
