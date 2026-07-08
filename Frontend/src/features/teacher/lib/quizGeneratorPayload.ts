import type {
  GenerateQuizPayload,
  QuizContentScope,
  QuizGeneratorFormState,
} from '@/features/teacher/types/quizGeneration';
import { mapFormDifficultyMode } from '@/features/teacher/lib/quizDifficultyValidation';
import {
  buildAllocationFields,
  type ChapterLessonsMap,
} from '@/features/teacher/lib/quizAllocation';

/** Build the canonical generate-quiz request body from form state. */
export function buildGenerateQuizPayload(
  form: QuizGeneratorFormState,
  options: { topicFocus?: string; chapterLessons?: ChapterLessonsMap } = {},
): GenerateQuizPayload {
  const { topicFocus, chapterLessons = {} } = options;
  // Default to SINGLE_CHAPTER so callers/forms that never set sourceScope keep
  // producing the exact legacy chapterId-only payload.
  const sourceScope = form.sourceScope ?? 'SINGLE_CHAPTER';

  // Per-lesson selection is only meaningful for a single chapter.
  const lessonIds =
    sourceScope === 'SINGLE_CHAPTER' && form.contentScope === 'SELECTED_LESSONS'
      ? [...form.lessonIds]
      : [];

  let scopeFields: Partial<GenerateQuizPayload>;
  if (sourceScope === 'MULTI_CHAPTER') {
    scopeFields = {
      sourceScope,
      chapterIds: [...form.chapterIds],
      contentScope: 'CHAPTER',
      lessonIds: [],
    };
  } else if (sourceScope === 'FULL_CURRICULUM') {
    scopeFields = {
      sourceScope,
      stageId: form.stageId,
      contentScope: 'CHAPTER',
      lessonIds: [],
    };
  } else {
    // SINGLE_CHAPTER: omit sourceScope so the wire payload stays byte-identical
    // to the legacy request (the backend defaults a missing scope to SINGLE_CHAPTER).
    scopeFields = {
      chapterId: form.chapterId,
      contentScope: form.contentScope,
      lessonIds,
    };
  }

  // Allocation fields (empty for AUTO ⇒ legacy body). May override
  // contentScope/lessonIds for single-chapter BY_LESSON.
  const allocationFields = buildAllocationFields(form, chapterLessons);

  const base = {
    ...scopeFields,
    ...allocationFields,
    questionCount: form.questionCount,
    types: form.questionTypes,
    difficultyMode: mapFormDifficultyMode(form.difficultyMode),
    ...(topicFocus ? { topicFocus } : {}),
  } as GenerateQuizPayload;

  if (form.difficultyMode === 'mixed') {
    return {
      ...base,
      difficultyMode: 'MIXED',
      difficultyDistribution: { ...form.mixedDifficulty },
    };
  }

  return {
    ...base,
    difficultyMode: 'SINGLE',
    difficulty: form.difficulty as 'easy' | 'medium' | 'hard',
  };
}

/** Whether the current source-scope selection has the inputs it needs. */
export function isGenerateSourceScopeValid(
  form: Pick<
    QuizGeneratorFormState,
    'sourceScope' | 'chapterId' | 'chapterIds' | 'stageId' | 'contentScope' | 'lessonIds'
  >,
): boolean {
  const sourceScope = form.sourceScope ?? 'SINGLE_CHAPTER';
  if (sourceScope === 'MULTI_CHAPTER') {
    return new Set(form.chapterIds).size >= 2;
  }
  if (sourceScope === 'FULL_CURRICULUM') {
    return Boolean(form.stageId);
  }
  // SINGLE_CHAPTER
  if (!form.chapterId) return false;
  return isGenerateFormScopeValid(form.contentScope, form.lessonIds);
}

export function shouldShowLessonPicker(contentScope: QuizContentScope): boolean {
  return contentScope === 'SELECTED_LESSONS';
}

export function clearLessonsOnChapterChange(): string[] {
  return [];
}

export function clearLessonsOnScopeChange(scope: QuizContentScope, current: string[]): string[] {
  return scope === 'CHAPTER' ? [] : current;
}

export function isGenerateFormScopeValid(
  contentScope: QuizContentScope,
  lessonIds: string[],
): boolean {
  if (contentScope === 'SELECTED_LESSONS') {
    return lessonIds.length > 0;
  }
  return true;
}
