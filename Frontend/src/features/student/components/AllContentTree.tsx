import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Atom,
  Network,
  BookOpen,
  Folder,
  FileText,
  ChevronDown,
  Clock,
  Lock,
  FolderOpen,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Card, Skeleton } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils/cn';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import { useStudentTree } from '@/features/student/hooks/useStudentContent';
import { useEnrollFree } from '@/features/student/hooks/useEnrollFree';
import type {
  StudentChapterNode,
  StudentContentTreeItem,
} from '@/features/student/types/studentContent';
import {
  getChapterStatusConfig,
  type ChapterBadgeToken,
} from '@/features/student/lib/chapterStatus';
import {
  ChapterEnrollModal,
  type ChapterEnrollTarget,
} from './ChapterEnrollModal';

/**
 * Gradient tile + icon cycled per stage. The gradients are our design-token
 * background utilities (tailwind.config.ts), not arbitrary palette stops, so
 * stage theming stays on-brand without inventing colors.
 */
const STAGE_VISUALS: Array<{ gradient: string; icon: LucideIcon }> = [
  { gradient: 'bg-cyan-gradient', icon: FlaskConical },
  { gradient: 'bg-purple-gradient', icon: Network },
  { gradient: 'bg-green-gradient', icon: Atom },
  { gradient: 'bg-cta-gradient', icon: BookOpen },
];

export function AllContentTree() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, isLoading, isError, refetch, isFetching } = useStudentTree();
  const enrollFreeMutation = useEnrollFree();

  // `null` override means "not toggled yet — use the derived defaults below".
  const [stageOverride, setStageOverride] = useState<Set<string> | null>(null);
  const [chapterOverride, setChapterOverride] = useState<Set<string> | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<ChapterEnrollTarget | null>(null);

  // Enroll button routes free vs paid chapters to the matching modal variant.
  const handleEnroll = (chapter: StudentChapterNode) => {
    const variant = chapter.enrollmentStatus === 'locked' ? 'locked' : 'free';
    setEnrollTarget({ chapter, variant });
  };

  const closeEnrollModal = () => {
    // Don't let an overlay/Escape close swallow an in-flight enrollment.
    if (enrollFreeMutation.isPending) return;
    setEnrollTarget(null);
  };

  const handleConfirmFree = (chapter: StudentChapterNode) => {
    enrollFreeMutation.mutate(chapter.id, {
      onSuccess: () => {
        dispatch(addToast({ type: 'success', message: t('student:content.enrollSuccess') }));
        setEnrollTarget(null);
      },
      onError: (error) => {
        dispatch(addToast({ type: 'error', message: translateApiError(t, error) }));
      },
    });
  };

  // Default expansion (first stage + its first accessible chapter) derived during
  // render — no effect, so it never triggers cascading re-renders. Once the
  // student toggles, their override takes precedence.
  const defaults = useMemo(() => {
    const stages = new Set<string>();
    const chapters = new Set<string>();
    const firstStage = data?.[0];
    if (firstStage) {
      stages.add(firstStage.stage.id);
      const firstAccessible = firstStage.chapters.find(
        (c) => c.chapter.enrollmentStatus !== 'locked',
      );
      if (firstAccessible) chapters.add(firstAccessible.chapter.id);
    }
    return { stages, chapters };
  }, [data]);

  const expandedStages = stageOverride ?? defaults.stages;
  const expandedChapters = chapterOverride ?? defaults.chapters;

  const summary = useMemo(() => {
    const stages = data?.length ?? 0;
    let chapters = 0;
    let lessons = 0;
    for (const item of data ?? []) {
      chapters += item.chapters.length;
      for (const ch of item.chapters) lessons += ch.lessons.length;
    }
    return { stages, chapters, lessons };
  }, [data]);

  const toggleStage = (id: string) =>
    setStageOverride((prev) => {
      const next = new Set(prev ?? defaults.stages);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleChapter = (id: string) =>
    setChapterOverride((prev) => {
      const next = new Set(prev ?? defaults.chapters);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (isLoading) return <TreeSkeleton />;
  if (isError) return <TreeError onRetry={() => refetch()} retrying={isFetching} />;
  if (!data || data.length === 0) {
    return <TreeEmpty onExplore={() => navigate('/student/courses')} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((item, stageIndex) => (
        <StageCard
          key={item.stage.id}
          item={item}
          index={stageIndex}
          expanded={expandedStages.has(item.stage.id)}
          onToggle={() => toggleStage(item.stage.id)}
          expandedChapters={expandedChapters}
          onToggleChapter={toggleChapter}
          onEnroll={handleEnroll}
        />
      ))}

      <p className="px-1 pt-1 font-cairo text-sm text-gray-500">
        {t('student:content.summary', {
          stages: toLocalNum(summary.stages),
          chapters: toLocalNum(summary.chapters),
          lessons: toLocalNum(summary.lessons),
        })}
      </p>

      <ChapterEnrollModal
        target={enrollTarget}
        onClose={closeEnrollModal}
        onSubscribe={(chapter) => {
          setEnrollTarget(null);
          navigate(`/student/pay/${chapter.id}`);
        }}
        onConfirmFree={handleConfirmFree}
        isEnrolling={enrollFreeMutation.isPending}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage                                                               */
/* ------------------------------------------------------------------ */

function StageCard({
  item,
  index,
  expanded,
  onToggle,
  expandedChapters,
  onToggleChapter,
  onEnroll,
}: {
  item: StudentContentTreeItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  expandedChapters: Set<string>;
  onToggleChapter: (id: string) => void;
  onEnroll: (chapter: StudentChapterNode) => void;
}) {
  const { t } = useTranslation();
  const visual = STAGE_VISUALS[index % STAGE_VISUALS.length]!;
  const StageIcon = visual.icon;

  return (
    <Card padding="none" className="overflow-hidden border border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-4 text-start transition-colors hover:bg-gray-50/60 sm:px-5"
      >
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm',
            visual.gradient,
          )}
        >
          <StageIcon size={20} className="text-white" />
        </span>
        <span className="min-w-0 flex-1 truncate font-cairo text-base font-bold text-navy-900">
          {t('student:content.stage', { order: toLocalNum(index + 1), name: item.stage.name })}
        </span>
        <ChevronDown
          size={20}
          className={cn('shrink-0 text-gray-400 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-2 sm:px-4">
          {item.chapters.map((chapterItem, chapterIndex) => (
            <ChapterRow
              key={chapterItem.chapter.id}
              chapterItem={chapterItem}
              index={chapterIndex}
              expanded={expandedChapters.has(chapterItem.chapter.id)}
              onToggle={onToggleChapter}
              onEnroll={onEnroll}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Chapter                                                             */
/* ------------------------------------------------------------------ */

function ChapterRow({
  chapterItem,
  index,
  expanded,
  onToggle,
  onEnroll,
}: {
  chapterItem: StudentContentTreeItem['chapters'][number];
  index: number;
  expanded: boolean;
  onToggle: (id: string) => void;
  onEnroll: (chapter: StudentChapterNode) => void;
}) {
  const { t } = useTranslation();
  const { chapter, lessons } = chapterItem;
  const config = getChapterStatusConfig(chapter.enrollmentStatus, chapter.price != null);

  // Explicit Enroll action for any chapter the student hasn't enrolled in yet
  // (free or locked). Once purchased, only the Subscribed badge shows.
  const showEnroll =
    chapter.enrollmentStatus === 'free' || chapter.enrollmentStatus === 'locked';

  // A not-yet-enrolled chapter with zero lessons can't be entered — enrolling
  // would land the student on a non-existent lesson URL. Gate it here: disable
  // Enroll and swap the price/free badge for a neutral "Coming soon" badge.
  // (Purchased chapters keep their Subscribed badge — they're already in.)
  const isEmpty = chapter.lessonCount === 0;
  const gateEmpty = showEnroll && isEmpty;
  const chapterLabel = t('student:content.chapter', {
    order: toLocalNum(index + 1),
    name: chapter.name,
  });

  const title = (
    <>
      <Folder size={18} className="shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-cairo text-sm font-semibold text-navy-900">{chapterLabel}</p>
        {chapter.description && (
          <p className="truncate font-cairo text-xs text-gray-400">{chapter.description}</p>
        )}
        {chapter.teacher && (
          <p className="truncate font-cairo text-xs text-cyan-600">{chapter.teacher.fullName}</p>
        )}
      </div>
    </>
  );

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="flex w-full items-center gap-3 px-2 py-3.5">
        {/* Expand/collapse is available only when the content is accessible
            (free / purchased). Locked chapters aren't expandable, so their title
            is a plain, non-interactive region. */}
        {config.accessible ? (
          <button
            type="button"
            onClick={() => onToggle(chapter.id)}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-start transition-colors hover:bg-gray-50/60"
          >
            {title}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{title}</div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {gateEmpty ? (
            // Amber "not-yet-ready" pill, mirroring the Locked badge's
            // icon+text pill so it carries the same visual weight as the
            // Free / Locked / Subscribed badges on other rows.
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-cairo text-xs font-medium text-amber-800">
              <Clock size={13} aria-hidden />
              {t('student:content.comingSoon')}
            </span>
          ) : (
            <ChapterBadges chapter={chapter} badges={config.badges} />
          )}
          {showEnroll && (
            <button
              type="button"
              aria-disabled={gateEmpty}
              title={gateEmpty ? t('student:content.emptyChapterTooltip') : undefined}
              onClick={(e) => {
                // Never let the Enroll click bubble up into a row toggle.
                e.stopPropagation();
                // Empty chapters can't be enrolled in — swallow the click so no
                // modal opens (aria-disabled keeps the tooltip working on hover).
                if (gateEmpty) return;
                onEnroll(chapter);
              }}
              className={cn(
                'shrink-0 rounded-button px-3 py-1 font-cairo text-xs font-semibold text-white transition-colors',
                gateEmpty
                  ? 'cursor-not-allowed bg-gray-300'
                  : 'bg-cyan-500 hover:bg-cyan-600',
              )}
            >
              {t('student:content.enroll')}
            </button>
          )}
        </div>

        {config.accessible && (
          <button
            type="button"
            onClick={() => onToggle(chapter.id)}
            aria-expanded={expanded}
            aria-label={chapterLabel}
            className="shrink-0"
          >
            <ChevronDown
              size={18}
              className={cn('text-gray-400 transition-transform', expanded && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {config.accessible && expanded && lessons.length > 0 && (
        <ul className="mb-3 ms-7 me-1 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
          {lessons.map((lesson, lessonIndex) => {
            const locked = !lesson.isUnlocked;
            const row = (
              <>
                <FileText size={15} className={cn('shrink-0', locked ? 'text-gray-300' : 'text-gray-400')} />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-cairo text-sm',
                    locked ? 'text-gray-400' : 'text-navy-700',
                  )}
                >
                  {t('student:content.lesson', {
                    order: toLocalNum(lessonIndex + 1),
                    title: lesson.title,
                  })}
                </span>
                {locked && <Lock size={14} className="shrink-0 text-gray-400" aria-hidden />}
              </>
            );

            return (
              <li
                key={lesson.id}
                className="border-b border-gray-100 last:border-b-0"
              >
                {locked ? (
                  <div
                    className="flex items-center gap-3 px-3 py-2.5"
                    title={lesson.lockReason ?? undefined}
                    aria-disabled
                  >
                    {row}
                  </div>
                ) : (
                  <Link
                    to={`/student/lessons/${lesson.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50/60"
                  >
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Renders chapter badges strictly from the resolved token list. Free /
 * Subscribed / Locked are mutually exclusive by construction (see
 * getChapterStatusConfig), so "Free + Subscribed" can never appear together.
 */
function ChapterBadges({
  chapter,
  badges,
}: {
  chapter: StudentChapterNode;
  badges: ChapterBadgeToken[];
}) {
  const { t } = useTranslation();

  return (
    <>
      {badges.map((badge) => {
        switch (badge) {
          case 'price':
            return chapter.price != null ? (
              <span
                key="price"
                className="inline-flex items-center rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 font-cairo text-xs font-medium text-purple-600"
                dir="ltr"
              >
                {t('student:content.badges.price', { price: toLocalNum(chapter.price) })}
              </span>
            ) : null;
          case 'free':
            return (
              <span
                key="free"
                className="inline-flex items-center rounded-full border border-success-500/30 bg-success-50 px-2.5 py-0.5 font-cairo text-xs font-medium text-success-600"
              >
                {t('student:content.badges.free')}
              </span>
            );
          case 'subscribed':
            return (
              <span
                key="subscribed"
                className="inline-flex items-center rounded-full bg-cyan-500 px-3 py-0.5 font-cairo text-xs font-medium text-white"
              >
                {t('student:content.badges.subscribed')}
              </span>
            );
          case 'locked':
            return (
              <span
                key="locked"
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-0.5 font-cairo text-xs font-medium text-gray-500"
              >
                <Lock size={12} />
                {t('student:content.badges.locked')}
              </span>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  States                                                              */
/* ------------------------------------------------------------------ */

function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} padding="none" className="overflow-hidden border border-gray-200">
          <div className="flex items-center gap-3 px-5 py-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-5 w-48" />
          </div>
          {i === 0 && (
            <div className="border-t border-gray-100 px-4 py-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 py-3.5">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function TreeEmpty({ onExplore }: { onExplore: () => void }) {
  const { t } = useTranslation();
  return (
    <Card padding="lg" className="border border-gray-200">
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-50">
          <FolderOpen size={40} className="text-purple-500" />
        </span>
        <h3 className="font-cairo text-lg font-bold text-navy-900">
          {t('student:content.empty.title')}
        </h3>
        <button
          type="button"
          onClick={onExplore}
          className="mt-2 flex min-h-[44px] items-center justify-center rounded-button bg-cyan-500 px-6 font-cairo text-sm font-semibold text-white transition-colors hover:bg-cyan-600"
        >
          {t('student:content.empty.cta')}
        </button>
      </div>
    </Card>
  );
}

function TreeError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation();
  return (
    <Card padding="lg" className="border border-gray-200">
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
          <AlertCircle size={32} className="text-danger-500" />
        </span>
        <h3 className="font-cairo text-lg font-bold text-navy-900">
          {t('student:content.error.title')}
        </h3>
        <p className="max-w-sm font-cairo text-sm text-gray-500">
          {t('student:content.error.description')}
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-2 flex min-h-[44px] items-center justify-center gap-2 rounded-button bg-navy-800 px-6 font-cairo text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:opacity-60"
        >
          <RefreshCw size={16} className={cn(retrying && 'animate-spin')} />
          {t('student:content.error.retry')}
        </button>
      </div>
    </Card>
  );
}
