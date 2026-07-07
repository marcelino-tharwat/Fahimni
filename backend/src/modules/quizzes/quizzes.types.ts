import type { QuestionType, QuizStatus } from "../../generated/prisma/client.js";

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
