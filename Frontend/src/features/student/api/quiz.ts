import { apiClient } from '@/shared/lib/api/client';
import type { QuestionType, QuizOption } from '@/shared/types';

export interface ApiOptionValue {
  id: string;
  label: string;
  text: string;
}

/** Raw question shape from the start-attempt response. */
interface RawQuestion {
  id: string;
  type: string;
  content: string;
  options: Record<string, string> | null;
  points: number;
  sortOrder: number;
}

/** Full start-attempt response shape. */
export interface StartAttemptResponse {
  attemptId: string;
  quizId: string;
  status: string;
  startedAt: string;
  totalPoints: number;
  durationMinutes: number | null;
  quiz: { id: string; title: string; description: string | null };
  questions: RawQuestion[];
}

/** Submit-attempt response shape (per result entry). */
export interface SubmitResultEntry {
  questionId: string;
  result: string;
  awardedPoints: number | null;
  maxPoints: number;
  feedback?: string;
}

export interface SubmitAttemptResponse {
  attemptId: string;
  quizId: string;
  status: string;
  score: number;
  totalPoints: number;
  percentage: number;
  pendingEssayCount: number;
  isFinal: boolean;
  results: SubmitResultEntry[];
}

export interface ChapterQuizInfo {
  id: string;
  title: string;
  description: string | null;
  chapterId: string | null;
  status: string;
  questionCount: number;
  questions: {
    id: string;
    type: string;
    content: string;
    options: Record<string, string> | null;
    sortOrder: number;
  }[];
}

const TYPE_MAP: Record<string, QuestionType> = {
  MCQ: 'mcq',
  TRUE_FALSE: 'tf',
  ESSAY: 'essay',
};

const LABEL_BY_LOCALE: Record<string, string[]> = {
  ar: ['أ', 'ب', 'ج', 'د'],
  en: ['A', 'B', 'C', 'D'],
};

const KEYS: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];

export function mapApiQuestion(
  raw: RawQuestion,
  _index: number,
  language: string,
): import('@/shared/types').QuizQuestion {
  const type = TYPE_MAP[raw.type] ?? 'mcq';
  const labels = LABEL_BY_LOCALE[language === 'ar' ? 'ar' : 'en'];

  let options: QuizOption[] | undefined;
  if (raw.options && type === 'mcq') {
    const entries = Object.entries(raw.options).slice(0, 4);
    options = entries.map(([key, text], i) => ({
      id: (key as 'a' | 'b' | 'c' | 'd') || KEYS[i],
      label: labels[i] ?? KEYS[i].toUpperCase(),
      text,
    }));
  }

  return {
    id: raw.id,
    type,
    text: raw.content,
    points: raw.points,
    options,
    placeholder: type === 'essay' ? undefined : undefined,
    maxLength: type === 'essay' ? 2000 : undefined,
  };
}

export function mapMetaFromAttempt(
  response: StartAttemptResponse,
): import('@/shared/types').QuizMeta {
  return {
    title: response.quiz.title,
    totalQuestions: response.questions.length,
    totalPoints: response.totalPoints,
    durationMinutes: response.durationMinutes ?? 30,
    attemptLabel: '1',
  };
}

export const quizApi = {
  /** GET /api/chapters/:chapterId/quizzes — published quizzes for a chapter. */
  getChapterQuizzes: (chapterId: string) =>
    apiClient.get<{ success: boolean; data: ChapterQuizInfo[] }>(
      `/chapters/${chapterId}/quizzes`,
    ),

  /** POST /api/quizzes/:id/attempt — start a new quiz attempt. */
  startAttempt: (quizId: string) =>
    apiClient.post<{ success: boolean; data: StartAttemptResponse }>(
      `/quizzes/${quizId}/attempt`,
    ),

  /** POST /api/attempts/:attemptId/submit — submit all answers. */
  submitAttempt: (attemptId: string, answers: { questionId: string; answer: string }[]) =>
    apiClient.post<{ success: boolean; data: SubmitAttemptResponse }>(
      `/attempts/${attemptId}/submit`,
      { answers },
    ),
};
