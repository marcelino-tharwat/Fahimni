import type { Stage } from '@/shared/types/content';
import type { Chapter } from '@/shared/types/content';
import type { Lesson } from '@/shared/types/content';

export type QuestionTypeKey = 'MCQ' | 'TF' | 'ESSAY';
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | '';
export interface QuizGeneratorFormState {
  stageId: string;
  chapterId: string;
  lessonIds: string[];
  title: string;
  questionCount: number;
  timeLimit: number;
  questionTypes: QuestionTypeKey[];
  difficultyMode: 'uniform' | 'mixed';
  difficulty: DifficultyLevel;
  mixedDifficulty: { easy: number; medium: number; hard: number };
}

export interface GenerateQuizPayload {
  chapterId: string;
  lessonIds?: string[];
  questionCount: number;
  types: ('MCQ' | 'TF' | 'ESSAY')[];
  difficulty: 'easy' | 'medium' | 'hard';
  topicFocus?: string;
}

export interface GenerateQuizResponse {
  id: string;
  title: string;
  description?: string;
  chapterId: string;
  status: 'DRAFT';
  questionCount: number;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
  questions: {
    id: string;
    quizId: string;
    type: string;
    content: string;
    options?: string[];
    correctAnswer?: string | boolean | number;
    sortOrder: number;
    points: number;
  }[];
}

export type { Stage, Chapter, Lesson };
