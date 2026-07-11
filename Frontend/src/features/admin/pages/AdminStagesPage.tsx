import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminStagesApi, type AdminStage } from '@/features/admin/api/adminStages';
import { Button, Spinner } from '@/shared/components/ui';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';

const ADMIN_STAGES_KEY = ['admin', 'stages'];

export function AdminStagesPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ADMIN_STAGES_KEY,
    queryFn: adminStagesApi.list,
  });
  const [editing, setEditing] = useState<AdminStage | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setDescription(editing.description ?? '');
    setSortOrder(String(editing.sortOrder));
  }, [editing]);

  const reset = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setSortOrder('0');
  };

  const saveStage = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        sortOrder: Number(sortOrder) || 0,
      };
      return editing ? adminStagesApi.update(editing.id, payload) : adminStagesApi.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_STAGES_KEY });
      dispatch(addToast({ type: 'success', message: t('adminStages.saved', 'Stage saved') }));
      reset();
    },
    onError: (error) =>
      dispatch(addToast({ type: 'error', message: (error as ApiError)?.message ?? t('status.error') })),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminStagesApi.setStatus(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_STAGES_KEY }),
    onError: (error) =>
      dispatch(addToast({ type: 'error', message: (error as ApiError)?.message ?? t('status.error') })),
  });

  const stages = data?.data ?? [];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-bold text-text-primary">
            {t('adminStages.title', 'Platform stages')}
          </h1>
          <p className="mt-1 font-cairo text-sm text-text-secondary">
            {t('adminStages.subtitle', 'Admin-owned educational stages used by all teachers.')}
          </p>
        </div>
        <Button onClick={reset}>
          <Plus size={16} />
          {t('adminStages.new', 'New stage')}
        </Button>
      </div>

      <form
        className="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-card md:grid-cols-[1fr_1fr_120px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          saveStage.mutate();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('adminStages.name', 'Stage name')}
          className="h-10 rounded-btn border border-border bg-white px-3 font-cairo text-sm outline-none focus:border-accent"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('adminStages.description', 'Description')}
          className="h-10 rounded-btn border border-border bg-white px-3 font-cairo text-sm outline-none focus:border-accent"
        />
        <input
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          type="number"
          min={0}
          className="h-10 rounded-btn border border-border bg-white px-3 font-cairo text-sm outline-none focus:border-accent"
          aria-label={t('adminStages.sortOrder', 'Sort order')}
        />
        <Button type="submit" disabled={saveStage.isPending || !name.trim()}>
          <Save size={16} />
          {editing ? t('actions.save') : t('actions.create')}
        </Button>
      </form>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
        {isLoading ? (
          <div className="flex justify-center py-16" role="status">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="p-8 text-center font-cairo text-danger">{t('status.error')}</div>
        ) : stages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <Layers className="text-text-muted" />
            <p className="font-cairo text-sm text-text-secondary">{t('adminStages.empty', 'No stages yet')}</p>
          </div>
        ) : (
          <table className="w-full min-w-[760px] text-start text-sm">
            <thead className="border-b border-border bg-gray-50 text-text-secondary">
              <tr>
                <th className="px-4 py-3 text-start">{t('adminStages.name', 'Stage name')}</th>
                <th className="px-4 py-3 text-start">{t('adminStages.counts', 'Content')}</th>
                <th className="px-4 py-3 text-start">{t('adminStages.owner', 'Owner')}</th>
                <th className="px-4 py-3 text-start">{t('adminStages.status', 'Status')}</th>
                <th className="px-4 py-3 text-end">{t('actions.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-cairo font-semibold text-text-primary">{stage.name}</div>
                    <div className="font-cairo text-xs text-text-secondary">{stage.description}</div>
                  </td>
                  <td className="px-4 py-3 font-cairo text-text-secondary">
                    {stage.chapterCount} / {stage.lessonCount}
                  </td>
                  <td className="px-4 py-3 font-cairo text-text-secondary">
                    {stage.teacherId ? t('adminStages.legacyTeacherOwned', 'Legacy teacher-owned') : t('adminStages.platformOwned', 'Platform')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate({ id: stage.id, isActive: !stage.isActive })}
                      className={`rounded-btn px-3 py-1 font-cairo text-xs font-semibold ${
                        stage.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {stage.isActive ? t('status.active') : t('status.inactive')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      type="button"
                      onClick={() => setEditing(stage)}
                      className="rounded-btn border border-border px-3 py-1.5 font-cairo text-xs font-semibold text-text-primary hover:bg-gray-50"
                    >
                      {t('actions.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
