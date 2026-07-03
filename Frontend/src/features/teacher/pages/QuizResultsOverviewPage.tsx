import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, TrendingUp, TrendingDown, UserCheck,
  Download, ChevronLeft, ChevronRight, ChevronsUpDown,
  ChevronUp, ChevronDown, ChevronLeft as ChevronLeftIcon,
  ClipboardList, AlertCircle, Loader2,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import { Avatar } from '@/shared/components/ui/Avatar';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useQuizResults, useExportResults } from '@/features/teacher/hooks/useQuizResults';
import { quizGenerationApi } from '@/features/teacher/api/quizGeneration';
import { useQuery } from '@tanstack/react-query';
import { getGradeBadge, toLocalNum } from '@/features/teacher/lib/quizResultsUtils';
import { cn } from '@/shared/lib/utils/cn';
import type { StudentResultRow } from '@/features/teacher/api/quizGeneration';

type TabKey = 'all' | 'passed' | 'failed';
type SortKey = 'studentName' | 'score' | 'percentage' | null;
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

function BinBar({ count, maxCount, pctLabel, variant }: { count: number; maxCount: number; pctLabel: string; variant: 'pass' | 'fail' }) {
  const height = maxCount > 0 ? (count / maxCount) * 140 : 0;
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <span className="text-xs font-semibold text-gray-600">{toLocalNum(count)}</span>
      <div className="flex w-full items-end justify-center" style={{ height: 140 }}>
        <div
          className={cn('w-8 rounded-t-sm transition-all', variant === 'pass' ? 'bg-cyan-500' : 'bg-danger-400')}
          style={{ height: `${height}px` }}
        />
      </div>
      <span className="text-xs text-gray-500">{pctLabel}</span>
    </div>
  );
}

const BIN_LABELS = ['0–20%', '21–40%', '41–60%', '61–80%', '81–100%'];

export function QuizResultsOverviewPage() {
  const { t } = useTranslation();
  const { quizId = '' } = useParams<{ quizId: string }>();

  const { data: resultsData, isLoading, isError, refetch } = useQuizResults(quizId);
  const exportMutation = useExportResults(quizId);

  const { data: quiz } = useQuery({
    queryKey: ['teacher', 'quizDetail', quizId],
    queryFn: () => quizGenerationApi.getDraftQuiz(quizId),
    enabled: Boolean(quizId),
  });

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const allResults = resultsData?.results ?? [];
  const isEmpty = allResults.length === 0;

  const filtered = useMemo(() => {
    if (activeTab === 'all') return allResults;
    if (activeTab === 'passed') return allResults.filter((r) => r.percentage >= 50);
    return allResults.filter((r) => r.percentage < 50);
  }, [allResults, activeTab]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'studentName') return a.studentName.localeCompare(b.studentName, 'ar') * dir;
      const aVal = sortKey === 'score' ? a.score : a.percentage;
      const bVal = sortKey === 'score' ? b.score : b.percentage;
      return (aVal - bVal) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );

  const counts = useMemo(() => {
    const passed = allResults.filter((r) => r.percentage >= 50).length;
    const failed = allResults.filter((r) => r.percentage < 50).length;
    return { all: allResults.length, passed, failed };
  }, [allResults]);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'asc') { setSortDir('desc'); }
      else if (sortDir === 'desc') { setSortKey(null); setSortDir('asc'); }
    } else {
      setSortKey(key);
      setSortDir(key === 'studentName' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  }, [sortKey, sortDir]);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  // Stats computation
  const stats = useMemo(() => {
    if (isEmpty) return null;
    const scores = allResults.map((r) => r.score);
    const percentages = allResults.map((r) => r.percentage);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const avgPct = percentages.reduce((s, v) => s + v, 0) / percentages.length;
    const highest = allResults.reduce((best, r) => (r.percentage > best.percentage ? r : best));
    const lowest = allResults.reduce((worst, r) => (r.percentage < worst.percentage ? r : worst));
    const passedCount = allResults.filter((r) => r.percentage >= 50).length;
    return { avg, avgPct, highest, lowest, passedCount, totalCount: allResults.length };
  }, [allResults, isEmpty]);

  // Distribution bins
  const bins = useMemo(() => {
    const binCounts = [0, 0, 0, 0, 0];
    for (const r of allResults) {
      const pct = r.percentage;
      if (pct <= 20) binCounts[0]++;
      else if (pct <= 40) binCounts[1]++;
      else if (pct <= 60) binCounts[2]++;
      else if (pct <= 80) binCounts[3]++;
      else binCounts[4]++;
    }
    const maxBin = Math.max(...binCounts, 1);
    return binCounts.map((c) => ({ count: c, maxCount: maxBin }));
  }, [allResults]);

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ChevronsUpDown size={14} className="shrink-0 text-gray-400" />;
    return sortDir === 'asc'
      ? <ChevronUp size={14} className="shrink-0 text-cyan-500" />
      : <ChevronDown size={14} className="shrink-0 text-cyan-500" />;
  }

  function SortableTh({ column, label, className }: { column: SortKey; label: string; className?: string }) {
    return (
      <th className={cn('px-4 py-3 text-start', className)}>
        <button
          type="button"
          onClick={() => handleSort(column)}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-600"
        >
          {label}
          <SortIcon column={column} />
        </button>
      </th>
    );
  }

  function StatSkeleton() {
    return (
      <div className="rounded-card border border-gray-300 bg-white p-4 shadow-card">
        <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
        <Skeleton className="mb-1 h-5 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6">
        <Skeleton className="mb-2 h-4 w-48" />
        <Skeleton className="mb-4 h-8 w-56" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
        <Skeleton className="h-[220px] rounded-card" />
        <Skeleton className="h-[400px] rounded-card" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col items-center justify-center gap-3 px-4 py-20">
        <AlertCircle size={48} className="text-gray-400" />
        <p className="text-sm text-gray-600">{t('teacher:essayGrading.loadError')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-btn border border-gray-300 px-5 py-2 text-sm text-gray-600"
        >
          {t('teacher:essayGrading.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link to="/teacher/quizzes" className="text-cyan-500 transition-colors hover:text-cyan-600">
          {t('teacher:teacherQuizResults.breadcrumb.quizzes')}
        </Link>
        <ChevronLeftIcon size={14} className="rtl:rotate-180 text-gray-400" />
        <Link to={`/teacher/quizzes/generator/publish/${quizId}`} className="text-cyan-500 transition-colors hover:text-cyan-600">
          {quiz?.title ?? ''}
        </Link>
        <ChevronLeftIcon size={14} className="rtl:rotate-180 text-gray-400" />
        <span className="font-semibold text-navy-900">{t('teacher:teacherQuizResults.breadcrumb.results')}</span>
      </nav>

      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h2 font-extrabold text-navy-900">{t('teacher:teacherQuizResults.pageTitle')}</h1>
          <p className="text-body text-gray-700">{quiz?.title ?? ''}</p>
          <p className="text-small text-gray-500">
            {quiz?.questionCount != null && (
              <>{toLocalNum(quiz.questionCount)} {t('teacher:teacherQuizResults.meta.questions')} • </>
            )}
            {quiz?.totalPoints != null && (
              <>{toLocalNum(quiz.totalPoints)} {t('teacher:teacherQuizResults.meta.points')} • </>
            )}
            {quiz?.durationMinutes != null && (
              <>{toLocalNum(quiz.durationMinutes)} {t('teacher:teacherQuizResults.meta.duration')}</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-btn border-2 border-cyan-500 px-4 text-sm font-bold text-cyan-500 transition-colors hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('teacher:teacherQuizResults.exportCSV')}
        >
          {exportMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          <span className="hidden md:inline">{t('teacher:teacherQuizResults.exportCSV')}</span>
        </button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-gray-300 bg-white py-20 shadow-card">
          <ClipboardList size={48} className="text-gray-400" />
          <h3 className="text-lg font-medium text-navy-900">{t('teacher:teacherQuizResults.empty.title')}</h3>
          <p className="text-sm text-gray-600">{t('teacher:teacherQuizResults.empty.description')}</p>
        </div>
      ) : (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {/* Avg score */}
            <div className="rounded-card border border-gray-300 bg-white p-4 shadow-card">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50">
                <BarChart3 size={20} className="text-cyan-500" />
              </div>
              <p className="text-h3 font-bold text-cyan-500">{toLocalNum(Math.round(stats!.avgPct))}%</p>
              <p className="text-small text-gray-500">{t('teacher:teacherQuizResults.stats.avgScore')}</p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${Math.min(100, stats!.avgPct)}%` }} />
              </div>
            </div>
            {/* Highest */}
            <div className="rounded-card border border-gray-300 bg-white p-4 shadow-card">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-success-50">
                <TrendingUp size={20} className="text-success-500" />
              </div>
              <p className="text-h3 font-bold text-success-500">{toLocalNum(stats!.highest.score)}/{toLocalNum(stats!.highest.totalPoints)}</p>
              <p className="text-small text-gray-500">{t('teacher:teacherQuizResults.stats.highest')}</p>
              <p className="mt-1 text-small text-gray-400">{stats!.highest.studentName}</p>
            </div>
            {/* Lowest */}
            <div className="rounded-card border border-gray-300 bg-white p-4 shadow-card">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-danger-50">
                <TrendingDown size={20} className="text-danger-500" />
              </div>
              <p className="text-h3 font-bold text-danger-500">{toLocalNum(stats!.lowest.score)}/{toLocalNum(stats!.lowest.totalPoints)}</p>
              <p className="text-small text-gray-500">{t('teacher:teacherQuizResults.stats.lowest')}</p>
              <p className="mt-1 text-small text-gray-400">{stats!.lowest.studentName}</p>
            </div>
            {/* Pass rate */}
            <div className="rounded-card border border-gray-300 bg-white p-4 shadow-card">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                <UserCheck size={20} className="text-success-500" />
              </div>
              <p className="text-h3 font-bold text-success-500">{toLocalNum(Math.round((stats!.passedCount / stats!.totalCount) * 100))}%</p>
              <p className="text-small text-gray-500">{t('teacher:teacherQuizResults.stats.passRate')}</p>
              <p className="mt-1 text-small text-gray-400">
                {t('teacher:teacherQuizResults.stats.passedStudents', { count: toLocalNum(stats!.passedCount), total: toLocalNum(stats!.totalCount) })}
              </p>
            </div>
          </div>

          {/* Distribution chart */}
          <div className="hidden rounded-card border border-gray-300 bg-white p-4 shadow-card md:block">
            <h3 className="mb-4 text-sm font-bold text-navy-900">{t('teacher:teacherQuizResults.distribution.title')}</h3>
            <div className="flex items-end gap-2">
              {BIN_LABELS.map((label, i) => (
                <BinBar
                  key={label}
                  count={bins[i].count}
                  maxCount={bins[i].maxCount}
                  pctLabel={label}
                  variant={i >= 2 ? 'pass' : 'fail'}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-cyan-500" />
                <span className="text-xs text-gray-500">{t('teacher:teacherQuizResults.distribution.passed')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-danger-400" />
                <span className="text-xs text-gray-500">{t('teacher:teacherQuizResults.distribution.failed')}</span>
              </div>
            </div>
          </div>

          {/* Filter tabs + table card */}
          <div className="overflow-hidden rounded-card bg-white shadow-card">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-300 px-4 pt-4">
              {(['all', 'passed', 'failed'] as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                    activeTab === tab
                      ? 'border-b-2 border-cyan-500 text-cyan-500 font-bold'
                      : 'text-gray-500 hover:text-navy-900',
                  )}
                >
                  {tab === 'all' && t('teacher:teacherQuizResults.filters.all', { count: toLocalNum(counts.all) })}
                  {tab === 'passed' && t('teacher:teacherQuizResults.filters.passed', { count: toLocalNum(counts.passed) })}
                  {tab === 'failed' && t('teacher:teacherQuizResults.filters.failed', { count: toLocalNum(counts.failed) })}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs',
                      activeTab === tab ? 'bg-cyan-50 text-cyan-500' : 'bg-gray-200 text-gray-500',
                    )}
                  >
                    {toLocalNum(tab === 'all' ? counts.all : tab === 'passed' ? counts.passed : counts.failed)}
                  </span>
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-200 text-xs font-medium text-gray-600">
                    <th className="px-4 py-3 text-start w-10">{t('teacher:teacherQuizResults.columns.row')}</th>
                    <SortableTh column="studentName" label={t('teacher:teacherQuizResults.columns.studentName')} />
                    <th className="px-4 py-3 text-start">{t('teacher:teacherQuizResults.columns.phone')}</th>
                    <SortableTh column="score" label={t('teacher:teacherQuizResults.columns.score')} />
                    <SortableTh column="percentage" label={t('teacher:teacherQuizResults.columns.percentage')} />
                    <th className="px-4 py-3 text-start">{t('teacher:teacherQuizResults.columns.grade')}</th>
                    <th className="px-4 py-3 text-start">{t('teacher:teacherQuizResults.columns.details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row, idx) => (
                    <QuizResultRow
                      key={row.attemptId}
                      row={row}
                      index={(safePage - 1) * PAGE_SIZE + idx}
                      quizId={quizId}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-600">
                {t('teacher:teacherQuizResults.pagination.showing', {
                  start: toLocalNum((safePage - 1) * PAGE_SIZE + 1),
                  end: toLocalNum(Math.min(safePage * PAGE_SIZE, sorted.length)),
                  total: toLocalNum(sorted.length),
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="flex items-center gap-1 rounded-btn px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                  {t('teacher:quizList.pagination.previous')}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="flex items-center gap-1 rounded-btn px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('teacher:quizList.pagination.next')}
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuizResultRow({ row, index, quizId }: { row: StudentResultRow; index: number; quizId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const badge = getGradeBadge(row.percentage);
  const isPassed = row.percentage >= 50;

  return (
    <tr
      className="cursor-pointer border-b border-gray-300 transition-colors hover:bg-gray-100 last:border-0"
      onClick={() => navigate(`/teacher/quizzes/${quizId}/results/${row.studentId}`)}
    >
      <td className="px-4 py-3 text-sm text-gray-400">{toLocalNum(index + 1)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={row.studentName} size="sm" />
          <span className="text-sm font-semibold text-navy-900">{row.studentName}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span dir="ltr" className="text-sm text-gray-600">{row.studentMobile ? toLocalNum(Number(row.studentMobile)) : '—'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-bold text-navy-900">{toLocalNum(row.score)}/{toLocalNum(row.totalPoints)}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className={cn('text-sm font-bold', isPassed ? 'text-success-500' : 'text-danger-500')}>
            {toLocalNum(row.percentage)}%
          </span>
          <div className="h-1 w-full max-w-[80px] overflow-hidden rounded-full bg-gray-200">
            <div
              className={cn('h-full rounded-full', isPassed ? 'bg-success-500' : 'bg-danger-500')}
              style={{ width: `${Math.min(100, row.percentage)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={badge.variant as any}>
          {badge.icon && <badge.icon size={12} className="ms-1" />}
          {t(`teacher:teacherQuizResults.gradeBadge.${badge.label}`)}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/teacher/quizzes/${quizId}/results/${row.studentId}`); }}
          className="inline-flex items-center gap-1 text-sm font-medium text-cyan-500 transition-colors hover:text-cyan-600"
        >
          {t('teacher:teacherQuizResults.detailsLink')}
          <ChevronRight size={14} className="rtl:rotate-180" />
        </button>
      </td>
    </tr>
  );
}
