import type { QuizQuestion } from '@/shared/types';

/**
 * Per-question result status as returned by the backend submit response.
 * `graded` is used once a teacher manually grades an essay; on the immediate
 * post-submit view essays are typically `pending`. `answered` is the neutral
 * status the backend sends when per-question correctness is hidden — the
 * student's answer is shown with no right/wrong signal.
 */
export type ResultStatus =
  | 'correct'
  | 'incorrect'
  | 'pending'
  | 'graded'
  | 'answered';

/**
 * One question merged with the student's answer and the backend grading
 * outcome. The backend intentionally does NOT expose `correctAnswer` to
 * students (see SCRUM-423 §9) — it stays optional and the UI renders the
 * "correct answer" hint only when the field happens to be present.
 */
export interface QuestionResult {
  question: QuizQuestion;
  studentAnswer: string;
  status: ResultStatus;
  awardedPoints: number | null;
  maxPoints: number;
  feedback?: string;
  correctAnswer?: string;
  explanation?: string;
  // Whether the per-question score (awardedPoints/maxPoints) was sent by the
  // backend. `false` when `showPerQuestionScores` is off — the UI then renders
  // no points badge. Absent (undefined) is treated as visible for legacy data.
  scoreVisible?: boolean;
}

/**
 * Full payload the results page renders. Built on the quiz page right after
 * submit (merging locally-held questions/answers with the submit response) and
 * passed via router navigation state — there is no GET endpoint to re-fetch it.
 */
export interface QuizResultsData {
  quizId: string;
  quizTitle: string;
  totalQuestions: number;
  score: number;
  totalPoints: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  pendingCount: number;
  results: QuestionResult[];
  // Additive result-visibility state (from the backend policy). Absent for
  // legacy quizzes, so existing behavior is unchanged.
  finalScoreHidden?: boolean;
  hasPendingEssayReview?: boolean;
  reviewMessage?: string | null;
  // True when per-question correctness is hidden (neither the correct answer
  // nor the per-question score is exposed). The UI then suppresses every
  // right/wrong signal — badges, colors, and the correct/wrong summary tiles.
  correctnessHidden?: boolean;
}

export type ResultFilterKey = 'all' | 'correct' | 'wrong' | 'pending';

/** Pass threshold — matches the backend (≥ 50%). */
export const PASS_THRESHOLD = 50;
