import type {
  GenerateQuizPayload,
  QuizContentScope,
  QuizGeneratorFormState,
} from '@/features/teacher/types/quizGeneration';

/** Build the canonical generate-quiz request body from form state. */
export function buildGenerateQuizPayload(
  form: Pick<
    QuizGeneratorFormState,
    'chapterId' | 'contentScope' | 'lessonIds' | 'questionCount' | 'questionTypes' | 'difficulty'
  >,
  topicFocus?: string,
): GenerateQuizPayload {
  const lessonIds =
    form.contentScope === 'SELECTED_LESSONS' ? [...form.lessonIds] : [];

  return {
    chapterId: form.chapterId,
    contentScope: form.contentScope,
    lessonIds,
    questionCount: form.questionCount,
    types: form.questionTypes,
    difficulty: form.difficulty as 'easy' | 'medium' | 'hard',
    ...(topicFocus ? { topicFocus } : {}),
  };
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
