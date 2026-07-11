import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, Search } from 'lucide-react';
import { Card, Skeleton } from '@/shared/components/ui';
import { useStages } from '@/features/teacher/hooks/useStages';

export function AllStagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: stages, isLoading, isError, error } = useStages();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const items = stages ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((s) => s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q));
  }, [stages, search]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('teacher:stages.title')}</h1>
          <p className="mt-1 font-cairo text-sm text-gray-500">
            {t('teacher:stages.platformSubtitle', 'Select an admin-managed stage to add your chapters and lessons.')}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative w-full md:max-w-sm">
          <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('teacher:stages.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pe-4 ps-10 font-cairo text-base text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {isLoading ? (
        <Card padding="md" className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
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
          <p className="font-cairo text-sm text-gray-500">
            {search ? t('status.empty') : t('teacher:stages.empty')}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => navigate(`/teacher/content/${stage.id}`)}
              className="rounded-card border border-gray-100 bg-white p-4 text-start shadow-card transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="font-cairo text-base font-bold text-navy-900">{stage.name}</h2>
              {stage.description && (
                <p className="mt-1 line-clamp-2 font-cairo text-sm text-gray-500">{stage.description}</p>
              )}
              <div className="mt-4 flex items-center gap-4 font-cairo text-sm text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <BookOpen size={15} className="text-cyan-600" />
                  {stage.chapterCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileText size={15} className="text-purple-600" />
                  {stage.lessonCount}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
