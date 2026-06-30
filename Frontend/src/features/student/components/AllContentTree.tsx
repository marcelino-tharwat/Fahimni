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
  Lock,
  FolderOpen,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Card, Skeleton } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils/cn';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { useStudentTree } from '@/features/student/hooks/useStudentContent';
import type {
  StudentChapterNode,
  StudentContentTreeItem,
} from '@/features/student/types/studentContent';
import {
  getChapterStatusConfig,
  type ChapterBadgeToken,
} from '@/features/student/lib/chapterStatus';
import { LockedChapterModal } from './LockedChapterModal';

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
  const { data, isLoading, isError, refetch, isFetching } = useStudentTree();

  // `null` override means "not toggled yet — use the derived defaults below".
  const [stageOverride, setStageOverride] = useState<Set<string> | null>(null);
  const [chapterOverride, setChapterOverride] = useState<Set<string> | null>(null);
  const [lockedChapter, setLockedChapter] = useState<StudentChapterNode | null>(null);

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
          onLockedChapter={setLockedChapter}
        />
      ))}

      <p className="px-1 pt-1 font-cairo text-sm text-gray-500">
        {t('student:content.summary', {
          stages: toLocalNum(summary.stages),
          chapters: toLocalNum(summary.chapters),
          lessons: toLocalNum(summary.lessons),
        })}
      </p>

      <LockedChapterModal
        chapter={lockedChapter}
        onClose={() => setLockedChapter(null)}
        onSubscribe={(chapter) => {
          setLockedChapter(null);
          navigate(`/student/pay/${chapter.id}`);
        }}
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
  onLockedChapter,
}: {
  item: StudentContentTreeItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  expandedChapters: Set<string>;
  onToggleChapter: (id: string) => void;
  onLockedChapter: (chapter: StudentChapterNode) => void;
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
              onLockedChapter={onLockedChapter}
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
  onLockedChapter,
}: {
  chapterItem: StudentContentTreeItem['chapters'][number];
  index: number;
  expanded: boolean;
  onToggle: (id: string) => void;
  onLockedChapter: (chapter: StudentChapterNode) => void;
}) {
  const { t } = useTranslation();
  const { chapter, lessons } = chapterItem;
  const config = getChapterStatusConfig(chapter.enrollmentStatus, chapter.price != null);

  const handleClick = () => {
    if (config.locksOnClick) onLockedChapter(chapter);
    else if (config.accessible) onToggle(chapter.id);
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={config.accessible ? expanded : undefined}
        className="flex w-full items-center gap-3 px-2 py-3.5 text-start transition-colors hover:bg-gray-50/60"
      >
        <Folder size={18} className="shrink-0 text-gray-400" />

        <div className="min-w-0 flex-1">
          <p className="truncate font-cairo text-sm font-semibold text-navy-900">
            {t('student:content.chapter', { order: toLocalNum(index + 1), name: chapter.name })}
          </p>
          {chapter.description && (
            <p className="truncate font-cairo text-xs text-gray-400">{chapter.description}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ChapterBadges chapter={chapter} badges={config.badges} />
        </div>

        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-gray-400 transition-transform',
            config.accessible && expanded && 'rotate-180',
          )}
        />
      </button>

      {config.accessible && expanded && lessons.length > 0 && (
        <ul className="mb-3 ms-7 me-1 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
          {lessons.map((lesson, lessonIndex) => (
            <li
              key={lesson.id}
              className="border-b border-gray-100 last:border-b-0"
            >
              <Link
                to={`/student/lessons/${lesson.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50/60"
              >
                <FileText size={15} className="shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate font-cairo text-sm text-navy-700">
                  {t('student:content.lesson', {
                    order: toLocalNum(lessonIndex + 1),
                    title: lesson.title,
                  })}
                </span>
              </Link>
            </li>
          ))}
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
