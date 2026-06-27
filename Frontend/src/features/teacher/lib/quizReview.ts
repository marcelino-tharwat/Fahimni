/**
 * Pure helpers for the Quiz Generator Step 2 (review & edit) flow.
 * Kept framework-free so they are unit-testable under the project's node-env
 * Vitest stack. No mock data, no network.
 */

export type ReviewQuestionType = 'MCQ' | 'TRUE_FALSE' | 'ESSAY';

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
}

export type DraftErrors = Partial<{
  content: string;
  options: string;
  correctAnswer: string;
}>;

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
} {
  if (draft.type === 'ESSAY') {
    return { type: draft.type, content: draft.content.trim(), options: {}, correctAnswer: null };
  }
  const options = draft.type === 'TRUE_FALSE' ? [...TF_OPTIONS] : draft.options.map((o) => o.trim());
  return {
    type: draft.type,
    content: draft.content.trim(),
    options: optionsToRecord(options),
    correctAnswer: draft.correctAnswer,
  };
}

/** A blank draft for the "Add question" flow, defaulted to the given type. */
export function blankDraft(type: ReviewQuestionType = 'MCQ'): QuestionDraft {
  if (type === 'MCQ') {
    return { type, content: '', options: ['', '', '', ''], correctAnswer: null };
  }
  if (type === 'TRUE_FALSE') {
    return { type, content: '', options: [...TF_OPTIONS], correctAnswer: null };
  }
  return { type, content: '', options: [], correctAnswer: null };
}

/** Build a draft from an existing question for editing. */
export function questionToDraft(q: ReviewQuestion): QuestionDraft {
  if (q.type === 'MCQ') {
    const options = [...q.options];
    while (options.length < MCQ_OPTION_COUNT) options.push('');
    return { type: q.type, content: q.content, options: options.slice(0, MCQ_OPTION_COUNT), correctAnswer: q.correctAnswer };
  }
  if (q.type === 'TRUE_FALSE') {
    return { type: q.type, content: q.content, options: [...TF_OPTIONS], correctAnswer: q.correctAnswer };
  }
  return { type: q.type, content: q.content, options: [], correctAnswer: null };
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
