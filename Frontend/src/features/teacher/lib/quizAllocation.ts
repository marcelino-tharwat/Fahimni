import type { TFunction } from 'i18next';
import type {
  AllocationMode,
  ChapterAllocationPayload,
  GenerateQuizPayload,
  LessonAllocationPayload,
  QuizGeneratorFormState,
} from '@/features/teacher/types/quizGeneration';

/** Max number of independent generation buckets (mirrors the backend guard). */
export const MAX_ALLOCATION_BUCKETS = 12;

/**
 * chapterId → ordered lessonIds for the currently selected source. Supplied by
 * the page from the eligibility snapshot so allocation logic stays pure.
 */
export type ChapterLessonsMap = Record<string, string[]>;

/**
 * Even, deterministic distribution of `total` questions across `count` slots
 * using the largest-remainder method (extra questions go to the earliest
 * slots). Used for the "auto distribute" convenience button. Never assigns a
 * negative count; when `total >= count` every slot gets at least 1.
 */
export function distributeEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const safeTotal = Math.max(0, Math.floor(total));
  const base = Math.floor(safeTotal / count);
  let remainder = safeTotal - base * count;
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return base + extra;
  });
}

/** Which allocation modes are offered for a given source scope. */
export function allowedAllocationModes(
  sourceScope: QuizGeneratorFormState['sourceScope'],
): AllocationMode[] {
  if (sourceScope === 'MULTI_CHAPTER') return ['AUTO', 'BY_CHAPTER', 'BY_LESSON'];
  if (sourceScope === 'SINGLE_CHAPTER') return ['AUTO', 'BY_LESSON'];
  // FULL_CURRICULUM stays AUTO-only for a clean, safe UX.
  return ['AUTO'];
}

/** Lessons the teacher assigned a positive count to, within a chapter. */
function allocatedLessonIds(
  form: QuizGeneratorFormState,
  lessonIds: string[],
): string[] {
  return lessonIds.filter((id) => (form.lessonQuestionCounts[id] ?? 0) > 0);
}

/** The lessons in scope for single-chapter BY_LESSON (chapter's lessons). */
function singleChapterLessonIds(
  form: QuizGeneratorFormState,
  ctx: ChapterLessonsMap,
): string[] {
  return ctx[form.chapterId] ?? form.lessonIds;
}

/** Live total of the current allocation (what will actually be generated). */
export function computeAllocationTotal(
  form: QuizGeneratorFormState,
  ctx: ChapterLessonsMap,
): number {
  const mode = form.allocationMode ?? 'AUTO';
  if (mode === 'AUTO') return form.questionCount;

  if (mode === 'BY_CHAPTER') {
    return form.chapterIds.reduce(
      (sum, id) => sum + (form.chapterQuestionCounts[id] ?? 0),
      0,
    );
  }

  // BY_LESSON (single- or multi-chapter).
  const lessonIds =
    form.sourceScope === 'SINGLE_CHAPTER'
      ? singleChapterLessonIds(form, ctx)
      : form.chapterIds.flatMap((cid) => ctx[cid] ?? []);
  return lessonIds.reduce(
    (sum, id) => sum + (form.lessonQuestionCounts[id] ?? 0),
    0,
  );
}

/** Total number of generation buckets the current allocation implies. */
export function countAllocationBuckets(
  form: QuizGeneratorFormState,
  ctx: ChapterLessonsMap,
): number {
  const mode = form.allocationMode ?? 'AUTO';
  if (mode === 'AUTO') return 1;
  if (mode === 'BY_CHAPTER') return form.chapterIds.length;
  const lessonIds =
    form.sourceScope === 'SINGLE_CHAPTER'
      ? singleChapterLessonIds(form, ctx)
      : form.chapterIds.flatMap((cid) => ctx[cid] ?? []);
  return allocatedLessonIds(form, lessonIds).length;
}

/**
 * Build the allocation-specific request fields. Returns an empty object for
 * AUTO so the legacy payload stays byte-identical. Assumes the caller already
 * validated the allocation (see {@link validateAllocation}).
 */
export function buildAllocationFields(
  form: QuizGeneratorFormState,
  ctx: ChapterLessonsMap,
): Partial<GenerateQuizPayload> {
  const mode = form.allocationMode ?? 'AUTO';
  if (mode === 'AUTO') return {};

  if (mode === 'BY_CHAPTER') {
    const chapterAllocations: ChapterAllocationPayload[] = form.chapterIds.map(
      (chapterId) => ({
        chapterId,
        questionCount: form.chapterQuestionCounts[chapterId] ?? 0,
      }),
    );
    return { allocationMode: 'BY_CHAPTER', chapterAllocations };
  }

  // BY_LESSON
  if (form.sourceScope === 'SINGLE_CHAPTER') {
    const lessonIds = allocatedLessonIds(form, singleChapterLessonIds(form, ctx));
    const lessonAllocations: LessonAllocationPayload[] = lessonIds.map((id) => ({
      lessonId: id,
      questionCount: form.lessonQuestionCounts[id] ?? 0,
    }));
    return {
      allocationMode: 'BY_LESSON',
      contentScope: 'SELECTED_LESSONS',
      lessonIds,
      lessonAllocations,
    };
  }

  // MULTI_CHAPTER BY_LESSON: group lesson allocations under each chapter.
  const chapterAllocations: ChapterAllocationPayload[] = form.chapterIds.map(
    (chapterId) => {
      const lessonIds = allocatedLessonIds(form, ctx[chapterId] ?? []);
      return {
        chapterId,
        lessonAllocations: lessonIds.map((id) => ({
          lessonId: id,
          questionCount: form.lessonQuestionCounts[id] ?? 0,
        })),
      };
    },
  );
  return { allocationMode: 'BY_LESSON', chapterAllocations };
}

/**
 * Validate the current allocation. Returns a map of field → localized message
 * (empty when valid). Mirrors the backend rules so the teacher sees issues
 * before ever sending a request.
 */
export function validateAllocation(
  form: QuizGeneratorFormState,
  ctx: ChapterLessonsMap,
  t: TFunction,
): Record<string, string> {
  const mode = form.allocationMode ?? 'AUTO';
  if (mode === 'AUTO') return {};

  const errs: Record<string, string> = {};
  const total = computeAllocationTotal(form, ctx);

  if (total < 1) {
    errs.allocation = t('teacher:quizGenerator.allocation.errorPositive');
    return errs;
  }

  if (mode === 'BY_CHAPTER') {
    for (const id of form.chapterIds) {
      if ((form.chapterQuestionCounts[id] ?? 0) < 1) {
        errs.allocation = t('teacher:quizGenerator.allocation.errorChapterPositive');
        break;
      }
    }
  } else if (form.sourceScope === 'SINGLE_CHAPTER') {
    const lessonIds = allocatedLessonIds(form, singleChapterLessonIds(form, ctx));
    if (lessonIds.length === 0) {
      errs.allocation = t('teacher:quizGenerator.allocation.errorLessonRequired');
    }
  } else {
    // MULTI_CHAPTER BY_LESSON: every selected chapter needs ≥1 allocated lesson.
    for (const id of form.chapterIds) {
      if (allocatedLessonIds(form, ctx[id] ?? []).length === 0) {
        errs.allocation = t('teacher:quizGenerator.allocation.errorChapterLessonRequired');
        break;
      }
    }
  }

  if (!errs.allocation && total !== form.questionCount) {
    errs.allocationTotal = t('teacher:quizGenerator.allocation.errorTotalMismatch', {
      total,
      expected: form.questionCount,
    });
  }

  if (!errs.allocation && countAllocationBuckets(form, ctx) > MAX_ALLOCATION_BUCKETS) {
    errs.allocation = t('teacher:quizGenerator.allocation.errorTooMany', {
      max: MAX_ALLOCATION_BUCKETS,
    });
  }

  return errs;
}
