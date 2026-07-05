import type { Stage } from '@/shared/types/content';
import type { Chapter } from '@/shared/types/content';
import type { Lesson } from '@/shared/types/content';

export type QuestionTypeKey = 'MCQ' | 'TF' | 'ESSAY';
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | '';
export type QuizContentScope = 'CHAPTER' | 'SELECTED_LESSONS';

/** Content source scope for AI generation. Defaults to SINGLE_CHAPTER (legacy). */
export type SourceScope = 'SINGLE_CHAPTER' | 'MULTI_CHAPTER' | 'FULL_CURRICULUM';

export interface QuizGeneratorFormState {
  stageId: string;
  chapterId: string;
  // Additive: generation source scope + multi-chapter selection.
  sourceScope: SourceScope;
  chapterIds: string[];
  contentScope: QuizContentScope;
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
  // Optional so a legacy chapterId-only body still validates as SINGLE_CHAPTER.
  chapterId?: string;
  sourceScope?: SourceScope;
  chapterIds?: string[];
  stageId?: string;
  contentScope: QuizContentScope;
  lessonIds: string[];
  questionCount: number;
  types: ('MCQ' | 'TF' | 'ESSAY')[];
  difficultyMode: 'SINGLE' | 'MIXED';
  difficulty?: 'easy' | 'medium' | 'hard';
  difficultyDistribution?: { easy: number; medium: number; hard: number };
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
