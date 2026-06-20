import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, BookOpen, FileText } from 'lucide-react';
import { Button, Card, Badge, Skeleton } from '@/shared/components/ui';
import { useStages } from '@/features/teacher/hooks/useStages';
import type { StageResponseDTO } from '@/features/teacher/types/stage';

export function AllStagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: stages, isLoading, isError, error } = useStages();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!stages) return [];
    if (!search.trim()) return stages;
    const q = search.toLowerCase();
    return stages.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q),
    );
  }, [stages, search]);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/teacher/dashboard')}
        className="mb-4 flex items-center gap-1.5 font-cairo text-sm font-medium text-navy-600 transition-colors hover:text-navy-900"
      >
        <ArrowLeft size={18} />
        {t('actions.back')}
      </button>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('teacher:stages.title')}</h1>
        <p className="mt-1 font-cairo text-sm text-gray-500">{t('teacher:stages.subtitle')}</p>
      </div>

      {/* Search + New Stage */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm">
          <Search
            size={18}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={t('teacher:stages.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pe-4 ps-10 font-cairo text-base text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <Button
          onClick={() => navigate('/teacher/content/new')}
          className="rounded-lg bg-cyan-500 hover:bg-cyan-600 whitespace-nowrap"
        >
          <Plus size={18} />
          {t('teacher:stages.newStage')}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <Card padding="md" className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </Card>
      ) : isError ? (
        <Card padding="lg" className="text-center">
          <p className="font-cairo text-sm text-danger-500">
            {error instanceof Error ? error.message : t('status.error')}
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="flex flex-col items-center gap-2 py-8">
            <BookOpen size={40} className="text-gray-300" />
            <p className="font-cairo text-sm text-gray-500">
              {search ? t('status.empty') : t('teacher:stages.empty')}
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-5">
            <ColLabel className="flex-1 text-start">
              {t('teacher:stages.columns.stageName')}
            </ColLabel>
            <ColLabel className="w-24 text-center">
              {t('teacher:stages.columns.chapters')}
            </ColLabel>
            <ColLabel className="w-24 text-center">
              {t('teacher:stages.columns.lessons')}
            </ColLabel>
            <ColLabel className="w-32 text-center">
              {t('teacher:stages.columns.actions')}
            </ColLabel>
          </div>

          {/* Stage rows */}
          {filtered.map((stage, idx) => (
            <div
              key={stage.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/teacher/content/${stage.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/teacher/content/${stage.id}`);
                }
              }}
              className="flex cursor-pointer items-center gap-3 rounded-card border border-gray-100 bg-white px-5 py-4 shadow-card transition-transform duration-200 ease-in-out hover:scale-[1.01] hover:shadow-md"
            >
              {/* Stage name */}
              <div className="flex min-w-0 flex-1 items-center gap-3 text-start">
                <StageMarker index={idx} />
                <div className="min-w-0">
                  <p className="font-cairo text-sm font-semibold text-navy-900">{stage.name}</p>
                  {stage.description && (
                    <p className="mt-0.5 font-cairo text-xs text-gray-400 line-clamp-1">
                      {stage.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Chapters */}
              <div className="flex w-24 items-center justify-center gap-1.5">
                <BookOpen size={14} className="text-cyan-500" />
                <span className="font-cairo text-sm font-medium text-navy-800">
                  {stage.chapterCount}
                </span>
              </div>

              {/* Lessons */}
              <div className="flex w-24 items-center justify-center gap-1.5">
                <FileText size={14} className="text-purple-500" />
                <span className="font-cairo text-sm font-medium text-navy-800">
                  {stage.lessonCount}
                </span>
              </div>

              {/* Actions */}
              <div className="flex w-32 items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/teacher/content/${stage.id}`);
                  }}
                  className="rounded-lg bg-cyan-600 px-4 py-1.5 font-cairo text-sm font-medium text-white transition-colors hover:bg-cyan-700"
                >
                  {t('teacher:stages.actions.details')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ColLabel({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={`font-cairo text-xs font-semibold uppercase tracking-wider text-gray-500 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

const MARKER_COLORS = [
  'bg-cyan-100 text-cyan-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-emerald-100 text-emerald-700',
  'bg-indigo-100 text-indigo-700',
];

function StageMarker({ index }: { index: number }) {
  const color = MARKER_COLORS[index % MARKER_COLORS.length];
  return <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${color}`}>{index + 1}</span>;
}
