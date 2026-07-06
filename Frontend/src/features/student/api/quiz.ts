import { apiClient } from '@/shared/lib/api/client';
import type { QuestionType, QuizOption } from '@/shared/types';
import type { StudentQuizzesData } from '@/features/student/types/studentQuiz';
import type {
  QuestionResult,
  QuizResultsData,
  ResultStatus,
} from '@/features/student/types/quizResults';
import { summarizeQuizResults } from '@/features/student/lib/quizResultStats';

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
  expiresAt: string;
  serverTime: string;
  totalPoints: number;
  durationMinutes: number;
  lastSavedAt: string | null;
  savedAnswers: { questionId: string; answer: string }[];
  quiz: { id: string; title: string; description: string | null };
  questions: RawQuestion[];
}

/** Submit-attempt response shape (per result entry). */
export interface SubmitResultEntry {
  questionId: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'ESSAY';
  questionText: string;
  options: string[] | null;
  // The backend result-visibility policy may OMIT these fields (they are only
  // hidden server-side, never sent). Kept optional so the UI renders safely.
  studentAnswer?: string;
  correctAnswer?: string | null;
  result: string;
  awardedPoints?: number | null;
  maxPoints?: number;
  feedback?: string;
  explanation?: string;
}

export interface SubmitAttemptResponse {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  status: string;
  // score/totalPoints/percentage are null when the final score is hidden.
  score: number | null;
  totalPoints: number | null;
  percentage: number | null;
  pendingEssayCount: number;
  isFinal: boolean;
  results: SubmitResultEntry[];
  // Additive result-visibility metadata (present for configured quizzes).
  hasPendingEssayReview?: boolean;
  pendingEssayResultMode?: string | null;
  message?: string | null;
  resultVisibility?: {
    configured: boolean;
    showCorrectAnswers: boolean;
    showPerQuestionScores: boolean;
    showFinalScore: boolean;
    showStudentAnswers: boolean;
    showExplanations: boolean;
    pendingEssayResultMode: string;
  };
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
    durationMinutes: response.durationMinutes,
    attemptLabel: '1',
  };
}

/** Resolve a student's raw answer into the backend-expected value. */
export function resolveAnswerForBackend(
  question: import('@/shared/types').QuizQuestion,
  raw: string | undefined,
): string {
  const hasAnswer = raw !== undefined && raw !== '';

  if (question.type === 'mcq' && question.options?.length) {
    const byId = hasAnswer ? question.options.find((o) => o.id === raw) : undefined;
    const byText = hasAnswer ? question.options.find((o) => o.text === raw) : undefined;
    return (byId ?? byText ?? question.options[0]).text;
  }
  if (question.type === 'tf') {
    return hasAnswer ? raw : 'خطأ';
  }
  return hasAnswer ? raw : '';
}

/** Build the submit payload — manual submit requires every question. */
export function buildSubmitAnswers(
  questions: import('@/shared/types').QuizQuestion[],
  answers: Record<string, string>,
  options?: { allowBlanks?: boolean },
): { questionId: string; answer: string }[] {
  return questions.map((q) => {
    const raw = answers[q.id];
    const resolved = resolveAnswerForBackend(q, raw);
    if (!options?.allowBlanks && resolved.trim() === '') {
      return { questionId: q.id, answer: q.type === 'essay' ? 'لا إجابة' : resolved };
    }
    return { questionId: q.id, answer: resolved };
  });
}

/** Build draft-save payload for answered questions only. */
export function buildDraftAnswers(
  questions: import('@/shared/types').QuizQuestion[],
  answers: Record<string, string>,
): { questionId: string; answer: string }[] {
  return questions
    .map((q) => {
      const raw = answers[q.id];
      if (raw === undefined || raw === '') return null;
      return { questionId: q.id, answer: resolveAnswerForBackend(q, raw) };
    })
    .filter((item): item is { questionId: string; answer: string } => item != null);
}

const RESULT_STATUSES: ResultStatus[] = [
  'correct',
  'incorrect',
  'pending',
  'graded',
  'answered',
];

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
      points: r.maxPoints ?? 0,
      options: r.options ? mapOptions(r.options) : undefined,
    },
    // A hidden field is simply absent from the API payload → render nothing.
    studentAnswer: r.studentAnswer ?? '',
    status: normalizeStatus(r.result),
    awardedPoints: r.awardedPoints ?? null,
    maxPoints: r.maxPoints ?? 0,
    // The per-question score is only present when `showPerQuestionScores` is on.
    scoreVisible: r.maxPoints != null,
    feedback: r.feedback,
    correctAnswer: r.correctAnswer ?? undefined,
    explanation: r.explanation,
  }));

  const { correctCount, wrongCount, pendingCount } = summarizeQuizResults(results);
  const finalScoreHidden = submit.score === null || submit.score === undefined;

  // Correctness is hidden only for a configured quiz whose teacher exposed
  // neither the correct answer nor the per-question score. Legacy quizzes (no
  // resultVisibility, or configured === false) keep showing everything.
  const vis = submit.resultVisibility;
  const correctnessHidden =
    vis?.configured === true && !vis.showCorrectAnswers && !vis.showPerQuestionScores;

  return {
    quizId: submit.quizId,
    quizTitle: submit.quizTitle,
    totalQuestions: submit.results.length,
    score: submit.score ?? 0,
    totalPoints: submit.totalPoints ?? 0,
    percentage: submit.percentage ?? 0,
    correctCount,
    wrongCount,
    pendingCount,
    results,
    finalScoreHidden,
    hasPendingEssayReview: submit.hasPendingEssayReview ?? false,
    reviewMessage: submit.message ?? null,
    correctnessHidden,
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

  /** PATCH /api/attempts/:attemptId/answers — persist draft answers. */
  saveDraftAnswers: (
    attemptId: string,
    answers: { questionId: string; answer: string }[],
  ) =>
    apiClient.patch<{ success: boolean; data: { lastSavedAt: string; savedCount: number } }>(
      `/attempts/${attemptId}/answers`,
      { answers },
    ),

  /** POST /api/attempts/:attemptId/submit — submit all answers. */
  submitAttempt: (
    attemptId: string,
    answers: { questionId: string; answer: string }[],
    submissionReason?: 'MANUAL' | 'TIME_EXPIRED',
  ) =>
    apiClient.post<{ success: boolean; data: SubmitAttemptResponse }>(
      `/attempts/${attemptId}/submit`,
      { answers, ...(submissionReason ? { submissionReason } : {}) },
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
