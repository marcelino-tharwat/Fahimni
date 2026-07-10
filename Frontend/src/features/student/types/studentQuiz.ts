export type QuizStatus = 'new' | 'passed' | 'failed' | 'pending';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuizAttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'GRADED' | 'NOT_STARTED';

/** Quiz placement scope — a per-lesson quiz vs the chapter-end quiz. */
export type QuizScope = 'LESSON' | 'CHAPTER';

/** Backend lock reason codes (mirrors StudentQuizEligibility). */
export type QuizLockReasonCode =
  | 'LESSON_NOT_COMPLETED'
  | 'CHAPTER_LESSONS_NOT_COMPLETED'
  | 'PREVIOUS_QUIZ_NOT_COMPLETED'
  | 'ENROLLMENT_REQUIRED'
  | 'QUIZ_NOT_PUBLISHED'
  | 'ATTEMPT_ALREADY_COMPLETED'
  | 'RETAKE_NOT_ALLOWED';

/**
 * Unified eligibility fields the backend attaches to every student-facing quiz.
 * Optional so legacy payloads / tests without them are treated as unlocked.
 */
export interface QuizEligibilityFields {
  quizScope?: QuizScope;
  isUnlocked?: boolean;
  canTake?: boolean;
  lockReason?: string | null;
  lockReasonCode?: QuizLockReasonCode | null;
  lessonId?: string | null;
  order?: number;
  previousQuizId?: string | null;
  previousQuizCompleted?: boolean;
}

/**
 * Source scope classifies how many chapters/stages the quiz was generated from.
 * Resolved server-side (never trusted from the client). Legacy quizzes default
 * to SINGLE_CHAPTER on the backend, but the field is optional here so a missing
 * value is treated as the single-chapter legacy fallback.
 */
export type QuizSourceScope = 'SINGLE_CHAPTER' | 'MULTI_CHAPTER' | 'FULL_CURRICULUM';

/** Student-safe source reference (chapter or stage) — id + title only. */
export interface QuizSourceRef {
  id: string;
  title: string;
}

/** Mirrors backend StudentQuizVisibilityDTO (lesson/chapter quiz surfaces). */
export interface StudentQuizVisibility extends QuizEligibilityFields {
  id: string;
  title: string;
  description: string | null;
  chapterId: string;
  contentScope: 'CHAPTER' | 'SELECTED_LESSONS';
  linkedLessonIds: string[];
  isRequiredForProgression: boolean;
  requiredForLessonId: string | null;
  questionCount: number;
  totalPoints: number;
  durationMinutes: number | null;
  displayStatus: QuizStatus;
  attemptId: string | null;
  studentAttemptStatus: QuizAttemptStatus;
  score?: number;
  retakeAllowed?: boolean;
}

export interface LessonQuizzesSection {
  available: StudentQuizVisibility[];
  required: StudentQuizVisibility | null;
}

export interface QuizItem extends QuizEligibilityFields {
  id: string;
  title: string;
  questionCount: number;
  points: number;
  durationMinutes: number | null;
  difficulty: Difficulty;
  status: QuizStatus;
  score?: number;
  retakeAllowed?: boolean;
  attemptId?: string | null;
  attemptStatus?: QuizAttemptStatus | null;
  /** Backend-resolved source scope. Absent on legacy quizzes → single-chapter. */
  sourceScope?: QuizSourceScope;
  /** Accessible source chapters (MULTI_CHAPTER only), backend-filtered. */
  sourceChapters?: QuizSourceRef[];
  /** Source stage (FULL_CURRICULUM only), when resolvable. */
  sourceStage?: QuizSourceRef;
}

export interface ChapterGroup {
  id: string;
  title: string;
  stage: string;
  quizzes: QuizItem[];
  defaultOpen: boolean;
}

export interface StudentQuizzesData {
  totalCount: number;
  completedCount: number;
  newCount: number;
  chapters: ChapterGroup[];
}
