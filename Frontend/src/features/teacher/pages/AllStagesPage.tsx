import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, MoreHorizontal, BookOpen, FileText } from 'lucide-react';
import { Button, Input, Card, Badge, Skeleton } from '@/shared/components/ui';
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
        <Input
          icon={<Search size={18} />}
          placeholder={t('teacher:stages.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button className="rounded-lg bg-cyan-500 hover:bg-cyan-600 whitespace-nowrap">
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
          <p className="font-cairo text-sm text-danger">
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
        <Card padding="none" className="overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <Th className="text-start">{t('teacher:stages.columns.stageName')}</Th>
                <Th className="w-24 text-center">{t('teacher:stages.columns.chapters')}</Th>
                <Th className="w-24 text-center">{t('teacher:stages.columns.lessons')}</Th>
                <Th className="w-16 text-center">{t('teacher:stages.columns.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((stage, idx) => (
                <tr
                  key={stage.id}
                  className="border-b border-gray-100 last:border-b-0 transition-colors hover:bg-gray-50/50"
                >
                  <td className="px-5 py-4 text-start">
                    <div className="flex items-center gap-3">
                      <StageMarker index={idx} />
                      <div>
                        <p className="font-cairo text-sm font-semibold text-navy-900">{stage.name}</p>
                        {stage.description && (
                          <p className="mt-0.5 font-cairo text-xs text-gray-400 line-clamp-1">
                            {stage.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <BookOpen size={14} className="text-cyan-500" />
                      <span className="font-cairo text-sm font-medium text-navy-800">
                        {stage.chapterCount}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <FileText size={14} className="text-purple-500" />
                      <span className="font-cairo text-sm font-medium text-navy-800">
                        {stage.lessonCount}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      className="rounded-btn p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-navy-600"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Th({ children, className }: { children: string; className?: string }) {
  return (
    <th
      className={`px-5 py-3 font-cairo text-xs font-semibold uppercase tracking-wider text-gray-500 ${className ?? ''}`}
    >
      {children}
    </th>
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
