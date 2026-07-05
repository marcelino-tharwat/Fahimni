import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/shared/components/ui';
import { AlertCircle, ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import type { Stage, Chapter } from '@/shared/types/content';
import type { Lesson } from '@/features/teacher/types/lesson';

import type { QuizContentScope, SourceScope } from '@/features/teacher/types/quizGeneration';

interface ContentSelectorProps {
  stageId: string;
  chapterId: string;
  contentScope: QuizContentScope;
  lessonIds: string[];
  onStageChange: (id: string) => void;
  onChapterChange: (id: string) => void;
  onContentScopeChange: (scope: QuizContentScope) => void;
  onLessonsChange: (ids: string[]) => void;
  stages: Stage[];
  chapters: Chapter[];
  lessons: Lesson[];
  stagesLoading: boolean;
  stagesError: string | null;
  chaptersLoading: boolean;
  chaptersError: string | null;
  lessonsLoading: boolean;
  lessonsError: string | null;
  onRetryStages: () => void;
  onRetryChapters: () => void;
  onRetryLessons: () => void;
  // Additive: source-scope selection (single/multi/full). When these are omitted
  // the component behaves exactly as before (single-chapter only).
  sourceScope?: SourceScope;
  chapterIds?: string[];
  onSourceScopeChange?: (scope: SourceScope) => void;
  onChaptersChange?: (ids: string[]) => void;
}

export function ContentSelector({
  stageId,
  chapterId,
  contentScope,
  lessonIds,
  onStageChange,
  onChapterChange,
  onContentScopeChange,
  onLessonsChange,
  stages,
  chapters,
  lessons,
  stagesLoading,
  stagesError,
  chaptersLoading,
  chaptersError,
  lessonsLoading,
  lessonsError,
  onRetryStages,
  onRetryChapters,
  onRetryLessons,
  sourceScope,
  chapterIds = [],
  onSourceScopeChange,
  onChaptersChange,
}: ContentSelectorProps) {
  const { t } = useTranslation();
  const effectiveScope: SourceScope = sourceScope ?? 'SINGLE_CHAPTER';
  const showSourceScopeSelector = Boolean(onSourceScopeChange);

  const toggleChapter = (id: string) => {
    if (!onChaptersChange) return;
    if (chapterIds.includes(id)) {
      onChaptersChange(chapterIds.filter((c) => c !== id));
    } else {
      onChaptersChange([...chapterIds, id]);
    }
  };
  const [open, setOpen] = useState(false);
  const [stageFocused, setStageFocused] = useState(false);
  const [chapterFocused, setChapterFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleLesson = (lessonId: string) => {
    if (lessonIds.includes(lessonId)) {
      onLessonsChange(lessonIds.filter((id) => id !== lessonId));
    } else {
      onLessonsChange([...lessonIds, lessonId]);
    }
  };

  const renderSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: { value: string; label: string }[],
    placeholder: string,
    disabled?: boolean,
    loading?: boolean,
    error?: string | null,
    onRetry?: () => void,
    focused?: boolean,
    onFocus?: () => void,
    onBlur?: () => void,
  ) => (
    <div className="flex w-full flex-col gap-1.5">
      <label className="font-cairo text-sm font-medium text-text-primary">{label}</label>
      <div className="relative">
        {loading ? (
          <div className="flex h-[48px] items-center gap-2 rounded-input border border-border bg-surface px-3">
            <Spinner size="sm" />
            <span className="font-cairo text-sm text-text-secondary">{t('teacher:quizGenerator.loading')}</span>
          </div>
        ) : error ? (
          <div className="flex h-[48px] items-center gap-2 rounded-input border border-danger bg-danger/10 px-3">
            <AlertCircle size={16} className="shrink-0 text-danger" />
            <span className="flex-1 font-cairo text-sm text-danger">{error}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="font-cairo text-sm font-medium text-danger underline hover:no-underline"
              >
                {t('teacher:quizGenerator.retry')}
              </button>
            )}
          </div>
        ) : (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            onFocus={onFocus}
            onBlur={onBlur}
            className={cn(
              'w-full h-12 px-4 pe-9 bg-gray-50 border rounded-input text-sm outline-none appearance-none transition-all duration-150',
              disabled && 'opacity-50 cursor-not-allowed bg-gray-100',
              error
                ? 'border-danger-500'
                : focused
                ? 'border-cyan-500 shadow-glow'
                : 'border-gray-300 hover:border-gray-400',
              value ? 'text-navy-800' : 'text-gray-400',
            )}
          >
            <option value="" hidden>{placeholder}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        <ChevronDown
          size={18}
          className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-text-secondary"
        />
      </div>
      {error && !loading && (
        <p className="flex items-center gap-1 font-cairo text-xs text-danger">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );

  const renderLessonsField = () => {
    if (lessonsLoading) {
      return (
        <div className="flex h-[48px] items-center gap-2 rounded-input border border-border bg-surface px-3">
          <Spinner size="sm" />
          <span className="font-cairo text-sm text-text-secondary">{t('teacher:quizGenerator.loading')}</span>
        </div>
      );
    }

    if (lessonsError) {
      return (
        <div className="flex h-[48px] items-center gap-2 rounded-input border border-danger bg-danger/10 px-3">
          <AlertCircle size={16} className="shrink-0 text-danger" />
          <span className="flex-1 font-cairo text-sm text-danger">{lessonsError}</span>
          <button
            type="button"
            onClick={onRetryLessons}
            className="font-cairo text-sm font-medium text-danger underline hover:no-underline"
          >
            {t('teacher:quizGenerator.retry')}
          </button>
        </div>
      );
    }

    if (!chapterId) {
      return (
        <div className="flex h-[48px] items-center rounded-input border border-border bg-surface px-3 opacity-50">
          <span className="font-cairo text-sm text-text-secondary">{t('teacher:quizGenerator.lessonsDisabled')}</span>
        </div>
      );
    }

    if (lessons.length === 0) {
      return (
        <div className="flex h-[48px] items-center rounded-input border border-border bg-surface px-3">
          <span className="font-cairo text-sm text-text-secondary">{t('teacher:quizGenerator.lessonsEmpty')}</span>
        </div>
      );
    }

    return (
      <div ref={ref} className="relative">
        <div
          onClick={() => setOpen(!open)}
          className={cn(
            'w-full min-h-[48px] px-4 py-2 bg-gray-50 border rounded-input text-sm outline-none transition-all duration-150 cursor-pointer flex items-center justify-between gap-2',
            open
              ? 'border-cyan-500 shadow-glow'
              : 'border-gray-300 hover:border-gray-400',
          )}
        >
          {lessonIds.length > 0 ? (
            lessonIds.map((id) => {
              const lesson = lessons.find((l) => l.id === id);
              return lesson ? (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-accent/10 text-accent"
                >
                  {lesson.title}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleLesson(id); }}
                    className="hover:text-danger transition-colors"
                  >
                    <X size={11} />
                  </button>
                </span>
              ) : null;
            })
          ) : (
            <span className="font-cairo text-sm text-gray-400">{t('teacher:quizGenerator.lessonsPlaceholder')}</span>
          )}
          <ChevronDown
            size={14}
            className={cn('text-text-secondary ms-auto shrink-0 transition-transform', open && 'rotate-180')}
          />
        </div>

        {open && (
          <div className="absolute top-full start-0 end-0 z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto mt-1">
            {lessons.map((lesson) => {
              const checked = lessonIds.includes(lesson.id);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => toggleLesson(lesson.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm transition-colors hover:bg-gray-100"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all',
                      checked ? 'bg-accent text-white' : 'border border-border bg-surface',
                    )}
                  >
                    {checked && <Check size={10} />}
                  </span>
                  <span className={cn(checked ? 'font-medium text-text-primary' : 'text-text-secondary')}>
                    {lesson.title}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const showLessonPicker = contentScope === 'SELECTED_LESSONS';
  const isSingle = effectiveScope === 'SINGLE_CHAPTER';
  const isMulti = effectiveScope === 'MULTI_CHAPTER';
  const isFull = effectiveScope === 'FULL_CURRICULUM';

  return (
    <div className="flex flex-col gap-4">
      {showSourceScopeSelector && (
        <div className="flex w-full flex-col gap-2">
          <label className="font-cairo text-sm font-medium text-text-primary">
            {t('teacher:quizGenerator.sourceScopeLabel')}
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                { value: 'SINGLE_CHAPTER' as const, label: t('teacher:quizGenerator.sourceSingle') },
                { value: 'MULTI_CHAPTER' as const, label: t('teacher:quizGenerator.sourceMulti') },
                { value: 'FULL_CURRICULUM' as const, label: t('teacher:quizGenerator.sourceFull') },
              ] as const
            ).map((option) => {
              const selected = effectiveScope === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSourceScopeChange?.(option.value)}
                  className={cn(
                    'rounded-xl border p-3 text-center font-cairo text-sm font-medium transition-all',
                    selected
                      ? 'border-cyan-500 bg-cyan-50 text-text-primary shadow-glow'
                      : 'border-gray-200 bg-gray-50 text-text-secondary hover:border-gray-300',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={cn('grid grid-cols-1 gap-4', isSingle && 'md:grid-cols-2')}>
        {renderSelect(
          t('teacher:quizGenerator.stage'),
          stageId,
          onStageChange,
          stages.map((s) => ({ value: s.id, label: s.name })),
          t('teacher:quizGenerator.stagePlaceholder'),
          false,
          stagesLoading,
          stagesError,
          onRetryStages,
          stageFocused,
          () => setStageFocused(true),
          () => setStageFocused(false),
        )}
        {isSingle &&
          renderSelect(
            t('teacher:quizGenerator.chapter'),
            chapterId,
            onChapterChange,
            chapters.map((c) => ({ value: c.id, label: c.name })),
            t('teacher:quizGenerator.chapterPlaceholder'),
            !stageId,
            chaptersLoading,
            chaptersError,
            onRetryChapters,
            chapterFocused,
            () => setChapterFocused(true),
            () => setChapterFocused(false),
          )}
      </div>

      {isFull && (
        <p className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 font-cairo text-xs text-text-secondary">
          {t('teacher:quizGenerator.sourceFullHint')}
        </p>
      )}

      {isMulti && (
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="font-cairo text-sm font-medium text-text-primary">
              {t('teacher:quizGenerator.chaptersLabel')}
            </label>
            {chapterIds.length > 0 && (
              <span className="font-cairo text-xs text-text-secondary">
                {t('teacher:quizGenerator.selectedChaptersCount', { count: chapterIds.length })}
              </span>
            )}
          </div>
          {!stageId ? (
            <div className="flex h-[48px] items-center rounded-input border border-border bg-surface px-3 opacity-50">
              <span className="font-cairo text-sm text-text-secondary">
                {t('teacher:quizGenerator.chaptersDisabled')}
              </span>
            </div>
          ) : chaptersLoading ? (
            <div className="flex h-[48px] items-center gap-2 rounded-input border border-border bg-surface px-3">
              <Spinner size="sm" />
              <span className="font-cairo text-sm text-text-secondary">{t('teacher:quizGenerator.loading')}</span>
            </div>
          ) : chapters.length === 0 ? (
            <div className="flex h-[48px] items-center rounded-input border border-border bg-surface px-3">
              <span className="font-cairo text-sm text-text-secondary">{t('teacher:quizGenerator.chaptersEmpty')}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 p-2">
              {chapters.map((c) => {
                const checked = chapterIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleChapter(c.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors hover:bg-white"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all',
                        checked ? 'bg-accent text-white' : 'border border-border bg-surface',
                      )}
                    >
                      {checked && <Check size={10} />}
                    </span>
                    <span className={cn('font-cairo', checked ? 'font-medium text-text-primary' : 'text-text-secondary')}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isSingle && (
      <div className="flex w-full flex-col gap-2">
        <label className="font-cairo text-sm font-medium text-text-primary">
          {t('teacher:quizGenerator.scopeLabel')}
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              {
                value: 'CHAPTER' as const,
                label: t('teacher:quizGenerator.scopeChapter'),
                hint: t('teacher:quizGenerator.scopeChapterHint'),
              },
              {
                value: 'SELECTED_LESSONS' as const,
                label: t('teacher:quizGenerator.scopeSelectedLessons'),
                hint: t('teacher:quizGenerator.scopeSelectedLessonsHint'),
              },
            ] as const
          ).map((option) => {
            const selected = contentScope === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!chapterId}
                onClick={() => onContentScopeChange(option.value)}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border p-3 text-start transition-all',
                  !chapterId && 'cursor-not-allowed opacity-50',
                  selected
                    ? 'border-cyan-500 bg-cyan-50 shadow-glow'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                )}
              >
                <span className="font-cairo text-sm font-medium text-text-primary">
                  {option.label}
                </span>
                <span className="font-cairo text-xs text-text-secondary">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {showLessonPicker && isSingle && (
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="font-cairo text-sm font-medium text-text-primary">
              {t('teacher:quizGenerator.lessons')}
            </label>
            {lessonIds.length > 0 && (
              <span className="font-cairo text-xs text-text-secondary">
                {t('teacher:quizGenerator.selectedLessonsCount', { count: lessonIds.length })}
              </span>
            )}
          </div>
          {renderLessonsField()}
        </div>
      )}
    </div>
  );
}
