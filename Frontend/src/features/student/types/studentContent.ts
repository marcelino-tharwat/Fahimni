/**
 * Frontend types for the student content APIs.
 *
 * Mirrors the backend contracts:
 *   GET /content/student/tree       -> StudentContentTreeItem[]  (raw array)
 *   GET /content/student/my-courses -> { success, message, data: MyCourse[] }
 *
 * Note the two endpoints intentionally use different envelopes (see
 * backend/src/modules/content/content.controller.ts); the API module handles
 * each shape so callers always receive a clean array.
 */

export type EnrollmentStatus = 'free' | 'purchased' | 'locked';

export interface StudentLessonNode {
  id: string;
  title: string;
  sortOrder: number;
}

export interface StudentChapterNode {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  /** null means the chapter is free (no price). */
  price: number | null;
  lessonCount: number;
  enrollmentStatus: EnrollmentStatus;
}

export interface StudentStageNode {
  id: string;
  name: string;
  sortOrder: number;
  chapterCount: number;
}

export interface StudentChapterTreeItem {
  chapter: StudentChapterNode;
  lessons: StudentLessonNode[];
}

export interface StudentContentTreeItem {
  stage: StudentStageNode;
  chapters: StudentChapterTreeItem[];
}

export interface MyCourse {
  id: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  price: number | null;
  stageId: string;
  stageName: string;
  lessonCount: number;
  completionProgress: number;
}
