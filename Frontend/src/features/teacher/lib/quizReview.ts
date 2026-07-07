/**
 * Pure helpers for the Quiz Generator Step 2 (review & edit) flow.
 * Kept framework-free so they are unit-testable under the project's node-env
 * Vitest stack. No mock data, no network.
 */

export type ReviewQuestionType = 'MCQ' | 'TRUE_FALSE' | 'ESSAY';

export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

/** Points bounds — mirrors backend quizzes.validation (MAX_QUESTION_POINTS). */
export const MIN_QUESTION_POINTS = 1;
export const MAX_QUESTION_POINTS = 100;

/** Default points per type when adding a question — mirrors the backend. */
export const DEFAULT_POINTS_BY_TYPE: Record<ReviewQuestionType, number> = {
  MCQ: 1,
  TRUE_FALSE: 1,
  ESSAY: 5,
};

/**
 * Teacher-only generation metadata attached to a question. Not persisted by the
 * backend (no schema column), so it is only available for the just-generated
 * draft (threaded via navigation state / sessionStorage). Absent fields render
 * as "غير محدد" and difficulty is simply hidden.
 */
export interface QuestionMetadata {
  difficulty: QuestionDifficulty | null;
  sourceLessonId: string | null;
  sourceLessonTitle: string | null;
  sourceChapterTitle: string | null;
}

/** A question as the Step 2 UI works with it (options always a clean string[]). */
export interface ReviewQuestion {
  id: string;
  quizId: string;
  type: ReviewQuestionType;
  content: string;
  options: string[];
  correctAnswer: string | null;
  sortOrder: number;
  points: number;
  // Teacher-only metadata (optional; only present for freshly generated drafts).
  difficulty?: QuestionDifficulty | null;
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  sourceChapterTitle?: string | null;
}

/** Raw question shape returned by GET /api/quizzes/:id (options may be array or record). */
export interface RawApiQuestion {
  id: string;
  quizId: string;
  type: string;
  content: string;
  options?: unknown;
  correctAnswer?: string | number | boolean | null;
  sortOrder?: number;
  points?: number;
}

export const MCQ_OPTION_COUNT = 4;
export const TF_TRUE = 'صح';
export const TF_FALSE = 'خطأ';
export const TF_OPTIONS: readonly string[] = [TF_TRUE, TF_FALSE];

/** A / B / C / D … label for an option index. */
export function optionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Map a question type to a Badge variant + i18n key suffix. */
export function typeBadge(type: ReviewQuestionType): {
  variant: 'info' | 'success' | 'warning' | 'default';
  key: string;
} {
  switch (type) {
    case 'MCQ':
      return { variant: 'info', key: 'mcq' };
    case 'TRUE_FALSE':
      return { variant: 'success', key: 'trueFalse' };
    case 'ESSAY':
      return { variant: 'warning', key: 'essay' };
    default:
      return { variant: 'default', key: 'unknown' };
  }
}

/** Normalize an options value (array OR record OR null) into an ordered string[]. */
export function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((o) => String(o)).filter((o) => o.length > 0);
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .map((o) => String(o))
      .filter((o) => o.length > 0);
  }
  return [];
}

const KNOWN_TYPES: ReviewQuestionType[] = ['MCQ', 'TRUE_FALSE', 'ESSAY'];

/** Convert a raw API question into a clean ReviewQuestion (never invents data). */
export function toReviewQuestion(raw: RawApiQuestion): ReviewQuestion {
  const type = (KNOWN_TYPES as string[]).includes(raw.type)
    ? (raw.type as ReviewQuestionType)
    : 'ESSAY';
  return {
    id: raw.id,
    quizId: raw.quizId,
    type,
    content: raw.content ?? '',
    options: type === 'ESSAY' ? [] : normalizeOptions(raw.options),
    correctAnswer:
      raw.correctAnswer === null || raw.correctAnswer === undefined
        ? null
        : String(raw.correctAnswer),
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : 0,
    points: typeof raw.points === 'number' ? raw.points : 1,
  };
}

/** Sort questions by sortOrder (stable) for display. */
export function sortQuestions(questions: ReviewQuestion[]): ReviewQuestion[] {
  return [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Total quiz score = sum of each question's points, with optional live overrides
 * (id → points) taking precedence. Used for the dynamic "إجمالي الدرجة" badge so
 * editing one question's points changes only that question's contribution.
 */
export function sumQuestionPoints(
  questions: ReviewQuestion[],
  overrides: Record<string, number> = {},
): number {
  return questions.reduce((sum, q) => sum + (overrides[q.id] ?? q.points), 0);
}

/** Convert an ordered options[] into the record map the backend expects. */
export function optionsToRecord(options: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  options.forEach((opt, i) => {
    record[String(i + 1)] = opt;
  });
  return record;
}

/** Editor working draft (what the QuestionEditor form holds). */
export interface QuestionDraft {
  type: ReviewQuestionType;
  content: string;
  options: string[];
  correctAnswer: string | null;
  points: number;
}

export type DraftErrors = Partial<{
  content: string;
  options: string;
  correctAnswer: string;
  points: string;
}>;

/**
 * Validate a points value. Returns an i18n key code when invalid, else null.
 * Rules mirror the backend: required, whole number, > 0, <= MAX_QUESTION_POINTS.
 */
export function validatePoints(value: number): string | null {
  if (!Number.isFinite(value)) {
    return 'errors.pointsRequired';
  }
  if (!Number.isInteger(value)) {
    return 'errors.pointsInteger';
  }
  if (value < MIN_QUESTION_POINTS) {
    return 'errors.pointsPositive';
  }
  if (value > MAX_QUESTION_POINTS) {
    return 'errors.pointsMax';
  }
  return null;
}

/**
 * Validate an editor draft. Returns i18n key codes (not text) per field so the
 * editor can localize. Empty object => valid.
 */
export function validateQuestionDraft(draft: QuestionDraft): DraftErrors {
  const errors: DraftErrors = {};

  if (!draft.content.trim()) {
    errors.content = 'errors.contentRequired';
  }

  if (draft.type === 'MCQ') {
    const opts = draft.options.map((o) => o.trim());
    if (opts.length !== MCQ_OPTION_COUNT || opts.some((o) => o.length === 0)) {
      errors.options = 'errors.mcqFourOptions';
    } else if (new Set(opts).size !== opts.length) {
      errors.options = 'errors.mcqDuplicateOptions';
    }
    if (!draft.correctAnswer || !opts.includes(draft.correctAnswer.trim())) {
      errors.correctAnswer = 'errors.correctAnswerRequired';
    }
  } else if (draft.type === 'TRUE_FALSE') {
    if (!draft.correctAnswer || !TF_OPTIONS.includes(draft.correctAnswer)) {
      errors.correctAnswer = 'errors.correctAnswerRequired';
    }
  }
  // ESSAY: content-only (no options / correctAnswer required).

  const pointsError = validatePoints(draft.points);
  if (pointsError) {
    errors.points = pointsError;
  }

  return errors;
}

export function isDraftValid(draft: QuestionDraft): boolean {
  return Object.keys(validateQuestionDraft(draft)).length === 0;
}

/** Build the API payload (options as record, essay cleared) from a valid draft. */
export function draftToApiPayload(draft: QuestionDraft): {
  type: ReviewQuestionType;
  content: string;
  options: Record<string, string>;
  correctAnswer: string | null;
  points: number;
} {
  if (draft.type === 'ESSAY') {
    return {
      type: draft.type,
      content: draft.content.trim(),
      options: {},
      correctAnswer: null,
      points: draft.points,
    };
  }
  const options = draft.type === 'TRUE_FALSE' ? [...TF_OPTIONS] : draft.options.map((o) => o.trim());
  return {
    type: draft.type,
    content: draft.content.trim(),
    options: optionsToRecord(options),
    correctAnswer: draft.correctAnswer,
    points: draft.points,
  };
}

/** A blank draft for the "Add question" flow, defaulted to the given type. */
export function blankDraft(type: ReviewQuestionType = 'MCQ'): QuestionDraft {
  const points = DEFAULT_POINTS_BY_TYPE[type];
  if (type === 'MCQ') {
    return { type, content: '', options: ['', '', '', ''], correctAnswer: null, points };
  }
  if (type === 'TRUE_FALSE') {
    return { type, content: '', options: [...TF_OPTIONS], correctAnswer: null, points };
  }
  return { type, content: '', options: [], correctAnswer: null, points };
}

/** Build a draft from an existing question for editing. */
export function questionToDraft(q: ReviewQuestion): QuestionDraft {
  const points = typeof q.points === 'number' ? q.points : DEFAULT_POINTS_BY_TYPE[q.type];
  if (q.type === 'MCQ') {
    const options = [...q.options];
    while (options.length < MCQ_OPTION_COUNT) options.push('');
    return { type: q.type, content: q.content, options: options.slice(0, MCQ_OPTION_COUNT), correctAnswer: q.correctAnswer, points };
  }
  if (q.type === 'TRUE_FALSE') {
    return { type: q.type, content: q.content, options: [...TF_OPTIONS], correctAnswer: q.correctAnswer, points };
  }
  return { type: q.type, content: q.content, options: [], correctAnswer: null, points };
}

// ── Teacher-only generation metadata (threaded from Step 1) ──────────────────

/** Raw generated question shape carrying optional teacher-only metadata. */
export interface GeneratedMetaQuestion {
  id: string;
  difficulty?: string | null;
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  sourceChapterTitle?: string | null;
}

function normalizeDifficulty(value: unknown): QuestionDifficulty | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toUpperCase();
  return key === 'EASY' || key === 'MEDIUM' || key === 'HARD' ? (key as QuestionDifficulty) : null;
}

/** Build a questionId → metadata map from a generation response's questions. */
export function buildMetadataMap(
  questions: GeneratedMetaQuestion[] | undefined | null,
): Record<string, QuestionMetadata> {
  const map: Record<string, QuestionMetadata> = {};
  for (const q of questions ?? []) {
    if (!q || typeof q.id !== 'string') continue;
    map[q.id] = {
      difficulty: normalizeDifficulty(q.difficulty),
      sourceLessonId: q.sourceLessonId ?? null,
      sourceLessonTitle: q.sourceLessonTitle ?? null,
      sourceChapterTitle: q.sourceChapterTitle ?? null,
    };
  }
  return map;
}

/** Merge a metadata map into review questions by id (leaves others untouched). */
export function mergeMetadata(
  questions: ReviewQuestion[],
  metadata: Record<string, QuestionMetadata>,
): ReviewQuestion[] {
  return questions.map((q) => {
    const meta = metadata[q.id];
    if (!meta) return q;
    return {
      ...q,
      difficulty: meta.difficulty,
      sourceLessonId: meta.sourceLessonId,
      sourceLessonTitle: meta.sourceLessonTitle,
      sourceChapterTitle: meta.sourceChapterTitle,
    };
  });
}

/** Ordered list of question ids after a drag move (for the reorder API). */
export function reorderIds(questions: ReviewQuestion[], fromId: string, toId: string): string[] {
  const ids = questions.map((q) => q.id);
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
