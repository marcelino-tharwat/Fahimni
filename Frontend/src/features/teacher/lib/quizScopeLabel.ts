import type { TFunction } from 'i18next';

export interface QuizScopeSummary {
  contentScope: 'CHAPTER' | 'SELECTED_LESSONS';
  chapter: { id: string; title: string } | null;
  lessons: { id: string; title: string }[];
}

/** Human-readable scope label for publish/review surfaces. */
export function formatQuizScopeLabel(scope: QuizScopeSummary, t: TFunction): string {
  if (scope.contentScope === 'CHAPTER') {
    return t('teacher:publish.scopeChapter');
  }
  if (scope.lessons.length === 1) {
    return t('teacher:publish.scopeOneLesson', { lesson: scope.lessons[0].title });
  }
  if (scope.lessons.length > 1) {
    return t('teacher:publish.scopeMultipleLessons', {
      count: scope.lessons.length,
      lessons: scope.lessons.map((l) => l.title).join('، '),
    });
  }
  return t('teacher:publish.scopeSelectedLessonsEmpty');
}
