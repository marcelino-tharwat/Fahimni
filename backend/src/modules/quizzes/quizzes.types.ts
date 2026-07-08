import type { QuestionType, QuizStatus } from "../../generated/prisma/client.js";
import type {
  QuizSourceScope,
  QuizSourceRefDTO,
} from "./quiz-scope.js";

export const quizPublicFields = {
  id: true,
  title: true,
  description: true,
  chapterId: true,
  contentScope: true,
  status: true,
  durationMinutes: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
} as const;

/**
 * Teacher-only projection: the public fields plus the raw source-scope columns.
 * NOT used on any student-facing path — students get the resolved, access-
 * filtered shape from {@link resolveStudentQuizSourceScopes} instead, never the
 * raw id array.
 */
export const quizTeacherFields = {
  ...quizPublicFields,
  sourceScope: true,
  sourceChapterIds: true,
  sourceStageId: true,
} as const;

export const questionPublicFields = {
  id: true,
  quizId: true,
  type: true,
  text: true,
  options: true,
  correctAnswer: true,
  explanation: true,
  sortOrder: true,
  points: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const studentQuestionPublicFields = {
  id: true,
  quizId: true,
  type: true,
  text: true,
  options: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface QuizScopeLessonDTO {
  id: string;
  title: string;
}

export interface QuizScopeSummaryDTO {
  contentScope: "CHAPTER" | "SELECTED_LESSONS";
  chapter: { id: string; title: string } | null;
  lessons: QuizScopeLessonDTO[];
}

export interface QuizResponseDTO {
  id: string;
  title: string;
  description: string | null;
  chapterId: string | null;
  contentScope: "CHAPTER" | "SELECTED_LESSONS";
  status: QuizStatus;
  durationMinutes: number | null;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  scope?: QuizScopeSummaryDTO;
  // Source provenance (teacher-facing). Raw columns are always present on
  // teacher reads; the resolved title arrays are attached by list/detail.
  sourceScope: QuizSourceScope;
  sourceChapterIds: string[];
  sourceStageId: string | null;
  sourceChapters?: QuizSourceRefDTO[];
  sourceStage?: QuizSourceRefDTO | null;
}

export interface QuizDetailResponseDTO extends QuizResponseDTO {
  questions: QuestionResponseDTO[];
}

export interface QuestionResponseDTO {
  id: string;
  quizId: string;
  type: QuestionType;
  content: string;
  options: Record<string, string>;
  correctAnswer: string | null;
  explanation: string | null;
  sortOrder: number;
  points: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizParams {
  quizId?: string;
}

export type QuizPublicFields = typeof quizPublicFields;
export type QuestionPublicFields = typeof questionPublicFields;

export interface QuestionReorderItem {
  id: string;
  sortOrder: number;
}
