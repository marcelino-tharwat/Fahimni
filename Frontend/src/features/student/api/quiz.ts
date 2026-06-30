import { apiClient } from '@/shared/lib/api/client';
import type { QuestionType, QuizOption } from '@/shared/types';
import type { StudentQuizzesData } from '@/features/student/types/studentQuiz';
import type {
  QuestionResult,
  QuizResultsData,
  ResultStatus,
} from '@/features/student/types/quizResults';

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
  type: 'MCQ' | 'TRUE_FALSE' | 'ESSAY';
  questionText: string;
  options: string[] | null;
  studentAnswer: string;
  correctAnswer: string | null;
  result: string;
  awardedPoints: number | null;
  maxPoints: number;
  feedback?: string;
  explanation?: string;
}

export interface SubmitAttemptResponse {
  attemptId: string;
  quizId: string;
  quizTitle: string;
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

const RESULT_STATUSES: ResultStatus[] = ['correct', 'incorrect', 'pending', 'graded'];

function normalizeStatus(raw: string): ResultStatus {
  return RESULT_STATUSES.includes(raw as ResultStatus)
    ? (raw as ResultStatus)
    : 'pending';
}

/** Map a backend question type to the frontend `QuestionType`. */
function mapBackendType(type: string): QuestionType {
  return TYPE_MAP[type] ?? 'mcq';
}

/**
 * Convert the backend's plain `string[]` options (e.g. ["Na", "K", "Ca", "Mg"])
 * into the `QuizOption[]` shape the result components expect, assigning the
 * a/b/c/d ids (matching the answer ids the student submitted) and Arabic
 * letter labels by position.
 */
function mapOptions(options: string[]): QuizOption[] {
  const labels = LABEL_BY_LOCALE.ar;
  return options.map((text, i) => ({
    id: KEYS[i] ?? 'a',
    label: labels[i] ?? KEYS[i]?.toUpperCase() ?? '',
    text,
  }));
}

/**
 * Map the backend submit/results response into the shape the results page
 * renders. The backend now returns every field per entry (questionText, type,
 * options, studentAnswer, correctAnswer, explanation), so no client-side merge
 * with locally-held questions/answers is needed. The same shape is returned by
 * both `submitAttempt` and `getAttemptResults`, so this handles both.
 */
export function buildQuizResults(submit: SubmitAttemptResponse): QuizResultsData {
  const results: QuestionResult[] = submit.results.map((r) => ({
    question: {
      id: r.questionId,
      type: mapBackendType(r.type),
      text: r.questionText,
      points: r.maxPoints,
      options: r.options ? mapOptions(r.options) : undefined,
    },
    studentAnswer: r.studentAnswer,
    status: normalizeStatus(r.result),
    awardedPoints: r.awardedPoints,
    maxPoints: r.maxPoints,
    feedback: r.feedback,
    correctAnswer: r.correctAnswer ?? undefined,
    explanation: r.explanation,
  }));

  return {
    quizId: submit.quizId,
    quizTitle: submit.quizTitle,
    totalQuestions: submit.results.length,
    score: submit.score,
    totalPoints: submit.totalPoints,
    percentage: submit.percentage,
    correctCount: results.filter((r) => r.status === 'correct').length,
    wrongCount: results.filter((r) => r.status === 'incorrect').length,
    pendingCount: results.filter((r) => r.status === 'pending' || r.status === 'graded').length,
    results,
  };
}

export const quizApi = {
  /** GET /api/quizzes/student — all quizzes for the student grouped by chapter. */
  getStudentQuizzes: () =>
    apiClient.get<{ success: boolean; data: StudentQuizzesData }>('/quizzes/student'),

  /** GET /api/chapters/:chapterId/quizzes — published quizzes for a chapter. */
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

/**
 * GET /api/attempts/:attemptId — re-fetch a submitted attempt's results.
 * Returns the same shape as `submitAttempt`, so `buildQuizResults` handles it.
 * Used on refresh / direct visit when there is no router navigation state.
 */
export async function getAttemptResults(attemptId: string): Promise<SubmitAttemptResponse> {
  const { data } = await apiClient.get<{ success: boolean; data: SubmitAttemptResponse }>(
    `/attempts/${attemptId}`,
  );
  return data.data;
}
