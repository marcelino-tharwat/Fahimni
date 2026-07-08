import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, ChevronDown, ChevronUp, AlertTriangle, Wand2, ListChecks } from 'lucide-react';
import type {
  AllocationMode,
  GeneratorSourceLesson,
  SourceScope,
} from '@/features/teacher/types/quizGeneration';
import { allowedAllocationModes } from '@/features/teacher/lib/quizAllocation';

interface AllocationControlsProps {
  sourceScope: SourceScope;
  allocationMode: AllocationMode;
  onAllocationModeChange: (mode: AllocationMode) => void;
  chapterId: string;
  chapterIds: string[];
  questionCount: number;
  chapterQuestionCounts: Record<string, number>;
  lessonQuestionCounts: Record<string, number>;
  onChapterCountChange: (chapterId: string, value: number) => void;
  onLessonCountChange: (lessonId: string, value: number) => void;
  onAutoDistribute: () => void;
  chapterNameById: Record<string, string>;
  lessonsByChapter: Record<string, GeneratorSourceLesson[]>;
  totalAllocated: number;
  fullCurriculum?: {
    eligibleChapters: number;
    eligibleLessons: number;
    canGenerate: boolean;
    warnings: string[];
  } | null;
  error?: string | null;
}

/** Compact number stepper matching the generator's question-count control. */
function NumberStepper({
  value,
  onChange,
  min = 0,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  ariaLabel: string;
}) {
  return (
    <div className="flex h-10 w-[120px] shrink-0 items-center overflow-hidden rounded-input border border-gray-200 bg-gray-50">
      <button
        type="button"
        aria-label={`${ariaLabel} -`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-full w-9 shrink-0 items-center justify-center text-text-secondary hover:bg-gray-100 border-e border-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        min={min}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="h-full w-full flex-1 border-0 bg-transparent text-center font-cairo text-sm font-medium text-navy-800 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label={`${ariaLabel} +`}
        onClick={() => onChange(value + 1)}
        className="flex h-full w-9 shrink-0 items-center justify-center text-text-secondary hover:bg-gray-100 border-s border-gray-200"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function LessonRow({
  lesson,
  value,
  onChange,
  noContentLabel,
}: {
  lesson: GeneratorSourceLesson;
  value: number;
  onChange: (v: number) => void;
  noContentLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-cairo text-sm text-text-primary">{lesson.title}</span>
        {!lesson.hasUsableContent && (
          <span className="flex items-center gap-1 font-cairo text-[11px] text-amber-600">
            <AlertTriangle size={11} />
            {noContentLabel}
          </span>
        )}
      </div>
      <NumberStepper value={value} onChange={onChange} ariaLabel={lesson.title} />
    </div>
  );
}

export function AllocationControls(props: AllocationControlsProps) {
  const { t } = useTranslation();
  const {
    sourceScope,
    allocationMode,
    onAllocationModeChange,
    chapterId,
    chapterIds,
    questionCount,
    chapterQuestionCounts,
    lessonQuestionCounts,
    onChapterCountChange,
    onLessonCountChange,
    onAutoDistribute,
    chapterNameById,
    lessonsByChapter,
    totalAllocated,
    fullCurriculum,
    error,
  } = props;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const modes = allowedAllocationModes(sourceScope);

  const modeLabel: Record<AllocationMode, string> = {
    AUTO: t('teacher:quizGenerator.allocation.modeAuto'),
    BY_CHAPTER: t('teacher:quizGenerator.allocation.modeByChapter'),
    BY_LESSON: t('teacher:quizGenerator.allocation.modeByLesson'),
  };

  const noContentLabel = t('teacher:quizGenerator.allocation.lessonNoContent');
  const showTotal = allocationMode !== 'AUTO';

  return (
    <div className="flex flex-col gap-4">
      {/* Mode selector — hidden for full curriculum (AUTO only). */}
      {modes.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('teacher:quizGenerator.allocation.modeLabel')}>
          {modes.map((mode) => {
            const active = allocationMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onAllocationModeChange(mode)}
                aria-pressed={active}
                className={`rounded-full px-4 py-2 font-cairo text-sm font-medium transition-colors ${
                  active
                    ? 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-300'
                    : 'bg-gray-50 text-text-secondary ring-1 ring-gray-200 hover:bg-gray-100'
                }`}
              >
                {modeLabel[mode]}
              </button>
            );
          })}
        </div>
      )}

      {/* Full-curriculum summary (AUTO only). */}
      {sourceScope === 'FULL_CURRICULUM' && fullCurriculum && (
        <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
          <p className="flex items-center gap-2 font-cairo text-sm font-semibold text-cyan-800">
            <ListChecks size={16} />
            {t('teacher:quizGenerator.allocation.fullCurriculumSummary')}
          </p>
          <p className="mt-1 font-cairo text-xs text-cyan-700">
            {t('teacher:quizGenerator.allocation.fullCurriculumCounts', {
              chapters: fullCurriculum.eligibleChapters,
              lessons: fullCurriculum.eligibleLessons,
            })}
          </p>
          {fullCurriculum.warnings.map((w) => (
            <p key={w} className="mt-1 flex items-center gap-1 font-cairo text-xs text-amber-600">
              <AlertTriangle size={11} />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* AUTO hint (non-full-curriculum). */}
      {allocationMode === 'AUTO' && sourceScope !== 'FULL_CURRICULUM' && (
        <p className="font-cairo text-xs text-text-secondary">
          {t('teacher:quizGenerator.allocation.autoHint')}
        </p>
      )}

      {/* BY_CHAPTER: one count per selected chapter. */}
      {allocationMode === 'BY_CHAPTER' && (
        <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 p-1">
          {chapterIds.map((cid) => (
            <div key={cid} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="truncate font-cairo text-sm font-medium text-text-primary">
                {chapterNameById[cid] ?? cid}
              </span>
              <NumberStepper
                value={chapterQuestionCounts[cid] ?? 0}
                onChange={(v) => onChapterCountChange(cid, v)}
                ariaLabel={chapterNameById[cid] ?? cid}
              />
            </div>
          ))}
        </div>
      )}

      {/* BY_LESSON, single chapter: one count per lesson. */}
      {allocationMode === 'BY_LESSON' && sourceScope === 'SINGLE_CHAPTER' && (
        <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 px-3 py-1">
          {(lessonsByChapter[chapterId] ?? []).map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              value={lessonQuestionCounts[lesson.id] ?? 0}
              onChange={(v) => onLessonCountChange(lesson.id, v)}
              noContentLabel={noContentLabel}
            />
          ))}
          {(lessonsByChapter[chapterId] ?? []).length === 0 && (
            <p className="py-3 font-cairo text-xs text-text-secondary">
              {t('teacher:quizGenerator.allocation.noLessons')}
            </p>
          )}
        </div>
      )}

      {/* BY_LESSON, multiple chapters: collapsible per-chapter lesson distribution. */}
      {allocationMode === 'BY_LESSON' && sourceScope === 'MULTI_CHAPTER' && (
        <div className="flex flex-col gap-2">
          {chapterIds.map((cid) => {
            const lessons = lessonsByChapter[cid] ?? [];
            const isOpen = expanded[cid] ?? true;
            const chapterTotal = lessons.reduce(
              (s, l) => s + (lessonQuestionCounts[l.id] ?? 0),
              0,
            );
            return (
              <div key={cid} className="rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [cid]: !isOpen }))}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start"
                >
                  <span className="truncate font-cairo text-sm font-medium text-text-primary">
                    {chapterNameById[cid] ?? cid}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-cairo text-xs text-text-secondary">
                      {chapterTotal}
                    </span>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>
                {isOpen && (
                  <div className="flex flex-col divide-y divide-gray-100 border-t border-gray-100 px-3 py-1">
                    {lessons.map((lesson) => (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        value={lessonQuestionCounts[lesson.id] ?? 0}
                        onChange={(v) => onLessonCountChange(lesson.id, v)}
                        noContentLabel={noContentLabel}
                      />
                    ))}
                    {lessons.length === 0 && (
                      <p className="py-3 font-cairo text-xs text-text-secondary">
                        {t('teacher:quizGenerator.allocation.noLessons')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-distribute + live total + validation. */}
      {showTotal && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onAutoDistribute}
            className="flex items-center gap-1.5 rounded-full border border-cyan-200 bg-white px-3 py-1.5 font-cairo text-xs font-medium text-cyan-700 hover:bg-cyan-50"
          >
            <Wand2 size={14} />
            {t('teacher:quizGenerator.allocation.autoDistribute')}
          </button>
          <span
            className={`font-cairo text-sm font-semibold ${
              totalAllocated === questionCount ? 'text-emerald-600' : 'text-text-secondary'
            }`}
          >
            {t('teacher:quizGenerator.allocation.total', {
              total: totalAllocated,
              expected: questionCount,
            })}
          </span>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1 font-cairo text-xs text-danger" role="alert">
          <AlertTriangle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
