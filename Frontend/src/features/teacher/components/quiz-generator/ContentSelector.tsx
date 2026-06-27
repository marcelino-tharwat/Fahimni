import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/shared/components/ui';
import { AlertCircle, ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import type { Stage, Chapter } from '@/shared/types/content';
import type { Lesson } from '@/features/teacher/types/lesson';

interface ContentSelectorProps {
  stageId: string;
  chapterId: string;
  lessonIds: string[];
  onStageChange: (id: string) => void;
  onChapterChange: (id: string) => void;
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
}

export function ContentSelector({
  stageId,
  chapterId,
  lessonIds,
  onStageChange,
  onChapterChange,
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
}: ContentSelectorProps) {
  const { t } = useTranslation();
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
            <option value="" disabled>{placeholder}</option>
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        {renderSelect(
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

      <div className="flex w-full flex-col gap-1.5">
        <label className="font-cairo text-sm font-medium text-text-primary">{t('teacher:quizGenerator.lessons')}</label>
        {renderLessonsField()}
      </div>
    </div>
  );
}
