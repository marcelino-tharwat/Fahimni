import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  BookCopy,
  Video,
  Users,
  HelpCircle,
  Folder,
  PlaySquare,
  User,
  FileQuestion,
  Plus,
  AlertCircle,
  RefreshCw,
  PackageOpen,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { Button, Card, Skeleton } from '@/shared/components/ui';
import { useTeacherDashboardStats } from '@/features/teacher/hooks/useTeacherDashboardStats';
import type { RecentActivity, TeacherDashboardStats } from '@/features/teacher/types/dashboard';

/* ------------------------------------------------------------------ */
/*  Static config                                                       */
/* ------------------------------------------------------------------ */

const CONTENT_ROUTE = '/teacher/content';

/** Gradient icon tile + soft border tint per stat, matching the reference. */
interface StatConfig {
  key: keyof Omit<TeacherDashboardStats, 'recentActivity'>;
  labelKey: string;
  icon: LucideIcon;
  gradient: string;
  border: string;
}

const STAT_CONFIG: StatConfig[] = [
  { key: 'totalStages', labelKey: 'teacher:dashboardView.stats.totalStages', icon: Layers, gradient: 'from-violet-500 to-purple-600', border: 'border-purple-100' },
  { key: 'totalChapters', labelKey: 'teacher:dashboardView.stats.totalChapters', icon: BookCopy, gradient: 'from-sky-400 to-blue-600', border: 'border-blue-100' },
  { key: 'totalLessons', labelKey: 'teacher:dashboardView.stats.totalLessons', icon: Video, gradient: 'from-teal-400 to-emerald-600', border: 'border-emerald-100' },
  { key: 'totalStudents', labelKey: 'teacher:dashboardView.stats.totalStudents', icon: Users, gradient: 'from-amber-400 to-orange-500', border: 'border-amber-100' },
  { key: 'totalQuizzes', labelKey: 'teacher:dashboardView.stats.totalQuizzes', icon: HelpCircle, gradient: 'from-fuchsia-500 to-purple-600', border: 'border-fuchsia-100' },
];

interface QuickActionConfig {
  labelKey: string;
  icon: LucideIcon;
  bg: string;
  text: string;
  iconColor: string;
}

const QUICK_ACTIONS: QuickActionConfig[] = [
  { labelKey: 'teacher:dashboardView.quickActions.newStage', icon: Layers, bg: 'bg-purple-50 hover:bg-purple-100/70', text: 'text-purple-700', iconColor: 'text-purple-500' },
  { labelKey: 'teacher:dashboardView.quickActions.newChapter', icon: BookCopy, bg: 'bg-blue-50 hover:bg-blue-100/70', text: 'text-blue-700', iconColor: 'text-blue-500' },
  { labelKey: 'teacher:dashboardView.quickActions.newLesson', icon: Video, bg: 'bg-emerald-50 hover:bg-emerald-100/70', text: 'text-emerald-700', iconColor: 'text-emerald-500' },
];

interface ActivityVisual {
  icon: LucideIcon;
  bg: string;
  color: string;
}

/** Icon + tint for an activity row, mirroring the reference per action/entity. */
function getActivityVisual(item: RecentActivity): ActivityVisual {
  if (item.action === 'QUIZ_COMPLETED' || item.actorType === 'STUDENT' || item.entityType === 'STUDENT') {
    return { icon: User, bg: 'bg-amber-50', color: 'text-amber-600' };
  }
  switch (item.entityType) {
    case 'STAGE':
      return { icon: Layers, bg: 'bg-teal-50', color: 'text-teal-600' };
    case 'CHAPTER':
      return { icon: Folder, bg: 'bg-purple-50', color: 'text-purple-600' };
    case 'LESSON':
      return { icon: PlaySquare, bg: 'bg-blue-50', color: 'text-blue-600' };
    case 'QUIZ':
      return { icon: FileQuestion, bg: 'bg-pink-50', color: 'text-pink-600' };
    default:
      return { icon: Activity, bg: 'bg-gray-100', color: 'text-gray-600' };
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Relative time ("2 hours ago") localized to the active language. */
function useRelativeTime() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const locale = i18n.language?.startsWith('ar') ? 'ar' : 'en';
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
      { amount: 60, unit: 'second' },
      { amount: 60, unit: 'minute' },
      { amount: 24, unit: 'hour' },
      { amount: 7, unit: 'day' },
      { amount: 4.34524, unit: 'week' },
      { amount: 12, unit: 'month' },
      { amount: Number.POSITIVE_INFINITY, unit: 'year' },
    ];
    return (iso: string): string => {
      let duration = (new Date(iso).getTime() - Date.now()) / 1000;
      if (!Number.isFinite(duration)) return '';
      for (const division of divisions) {
        if (Math.abs(duration) < division.amount) {
          return rtf.format(Math.round(duration), division.unit);
        }
        duration /= division.amount;
      }
      return '';
    };
  }, [i18n.language]);
}

/** Safely read a display name from sanitized activity metadata. */
function activityName(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '';
  const candidate =
    metadata.name ?? metadata.title ?? metadata.quizName ?? metadata.chapterName;
  return typeof candidate === 'string' ? candidate : '';
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function TeacherDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useTeacherDashboardStats();

  const goToContent = () => navigate(CONTENT_ROUTE);

  const isEmpty =
    !!data &&
    data.totalStages === 0 &&
    data.totalChapters === 0 &&
    data.totalLessons === 0 &&
    data.totalStudents === 0 &&
    data.totalQuizzes === 0 &&
    data.recentActivity.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Heading + welcome */}
      <header>
        <h1 className="font-cairo text-2xl font-bold text-navy-900">
          {t('teacher:dashboardView.title')}
        </h1>
        <p className="mt-1 font-cairo text-sm text-gray-600">
          {t('teacher:dashboardView.welcome')}
        </p>
      </header>

      {isError ? (
        <DashboardError onRetry={() => refetch()} retrying={isFetching} />
      ) : isLoading ? (
        <DashboardSkeleton />
      ) : isEmpty ? (
        <DashboardEmpty onCreateStage={goToContent} />
      ) : (
        data && <DashboardContent data={data} onQuickAction={goToContent} onViewAll={goToContent} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loaded content                                                      */
/* ------------------------------------------------------------------ */

function DashboardContent({
  data,
  onQuickAction,
  onViewAll,
}: {
  data: TeacherDashboardStats;
  onQuickAction: () => void;
  onViewAll: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {/* Statistics */}
      <section
        aria-label={t('teacher:dashboardView.statsRegion')}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
      >
        {STAT_CONFIG.map((stat) => (
          <div
            key={stat.key}
            className={`flex flex-col gap-4 rounded-card border ${stat.border} bg-white p-5 shadow-card`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br sm:h-14 sm:w-14 sm:rounded-2xl ${stat.gradient} shadow-md`}
            >
              <stat.icon size={22} className="text-white" />
            </div>
            <div>
              <div
                className="font-cairo text-3xl font-extrabold leading-tight text-navy-900"
                dir="ltr"
              >
                {data[stat.key].toLocaleString('en-US')}
              </div>
              <div className="font-cairo text-sm text-gray-500">{t(stat.labelKey)}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Quick Actions */}
      <section aria-label={t('teacher:dashboardView.quickActions.title')}>
        <h2 className="mb-3 font-cairo text-lg font-bold text-navy-900">
          {t('teacher:dashboardView.quickActions.title')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.labelKey}
              type="button"
              onClick={onQuickAction}
              className={`flex min-h-[64px] items-center justify-center gap-2 rounded-card ${action.bg} px-4 font-cairo text-sm font-semibold ${action.text} transition-colors`}
            >
              <action.icon size={20} className={action.iconColor} />
              <span className="flex items-center gap-1">
                <Plus size={15} />
                {t(action.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section aria-label={t('teacher:dashboardView.activity.title')}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-cairo text-lg font-bold text-navy-900">
            {t('teacher:dashboardView.activity.title')}
          </h2>
          {data.recentActivity.length > 0 && (
            <button
              type="button"
              onClick={onViewAll}
              className="rounded-btn border border-gray-200 px-3 py-1.5 font-cairo text-xs font-medium text-navy-700 transition-colors hover:bg-gray-50"
            >
              {t('teacher:dashboardView.activity.viewAll')}
            </button>
          )}
        </div>
        <Card padding={data.recentActivity.length === 0 ? 'lg' : 'none'} className="overflow-hidden">
          {data.recentActivity.length === 0 ? (
            <p className="py-4 text-center font-cairo text-sm text-gray-500">
              {t('teacher:dashboardView.activity.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recentActivity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}

function ActivityRow({ item }: { item: RecentActivity }) {
  const { t } = useTranslation();
  const formatRelative = useRelativeTime();

  const visual = getActivityVisual(item);
  const Icon = visual.icon;

  // Localized sentence composed from structured data. Teacher-authored events
  // read as "You ..."; student-generated events use the actor's name.
  const actor =
    item.actorType === 'TEACHER' || !item.actorName
      ? t('teacher:dashboardView.activity.you')
      : item.actorName;

  const text = t(`teacher:dashboardView.activity.actions.${item.action}`, {
    actor,
    name: activityName(item.metadata),
    defaultValue: t('teacher:dashboardView.activity.actions.fallback', { actor }),
  });

  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-btn ${visual.bg}`}>
        <Icon size={18} className={visual.color} />
      </span>
      <p className="min-w-0 flex-1 truncate font-cairo text-sm text-navy-800">{text}</p>
      <span className="shrink-0 font-cairo text-xs text-gray-400" dir="ltr">
        {formatRelative(item.createdAt)}
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  States                                                              */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-card border border-gray-100 bg-white p-5 shadow-card"
          >
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-card" />
        ))}
      </div>
      <Card className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-btn" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </Card>
    </>
  );
}

function DashboardEmpty({ onCreateStage }: { onCreateStage: () => void }) {
  const { t } = useTranslation();
  return (
    <Card padding="lg">
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-50">
          <PackageOpen size={32} className="text-purple-500" />
        </span>
        <h3 className="font-cairo text-lg font-semibold text-navy-900">
          {t('teacher:dashboardView.empty.title')}
        </h3>
        <p className="max-w-sm font-cairo text-sm text-gray-500">
          {t('teacher:dashboardView.empty.description')}
        </p>
        <Button onClick={onCreateStage} className="mt-2">
          <Plus size={18} />
          {t('teacher:dashboardView.quickActions.newStage')}
        </Button>
      </div>
    </Card>
  );
}

function DashboardError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation();
  return (
    <Card padding="lg">
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
          <AlertCircle size={32} className="text-danger-500" />
        </span>
        <h3 className="font-cairo text-lg font-semibold text-navy-900">
          {t('teacher:dashboardView.error.title')}
        </h3>
        <p className="max-w-sm font-cairo text-sm text-gray-500">
          {t('teacher:dashboardView.error.description')}
        </p>
        <Button variant="danger" onClick={onRetry} loading={retrying} className="mt-2">
          <RefreshCw size={18} />
          {t('teacher:dashboardView.error.retry')}
        </Button>
      </div>
    </Card>
  );
}
