import type { QuestionType, QuizStatus } from "../../generated/prisma/client.js";

export const quizPublicFields = {
  id: true,
  title: true,
  description: true,
  chapterId: true,
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
  sortOrder: true,
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

export interface QuizResponseDTO {
  id: string;
  title: string;
  description: string | null;
  chapterId: string | null;
  status: QuizStatus;
  durationMinutes: number | null;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
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
  sortOrder: number;
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
