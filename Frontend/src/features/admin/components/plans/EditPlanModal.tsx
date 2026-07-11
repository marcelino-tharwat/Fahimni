import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/shared/components/ui';
import { translateApiError } from '@/shared/lib/api/translateError';
import { useUpdatePlan } from '@/features/admin/hooks/useAdminPlans';
import type { AdminPlanListItem, UpdatePlanInput } from '@/features/admin/types/plans';

interface EditPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: AdminPlanListItem | null;
}

export function EditPlanModal({ isOpen, onClose, plan }: EditPlanModalProps) {
  const { t } = useTranslation();
  const updateMutation = useUpdatePlan();
  const [form, setForm] = useState<UpdatePlanInput>({});
  const [featuresJson, setFeaturesJson] = useState('{}');
  const [limitsJson, setLimitsJson] = useState('{}');

  useEffect(() => {
    if (plan) {
      setForm({
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        isActive: plan.isActive,
        isRecommended: plan.isRecommended,
        sortOrder: plan.sortOrder,
      });
      setFeaturesJson(JSON.stringify(plan.features ?? {}, null, 2));
      setLimitsJson(JSON.stringify(plan.limits ?? {}, null, 2));
    }
  }, [plan]);

  const update = (key: keyof UpdatePlanInput, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!plan) return;

    const input: UpdatePlanInput = { ...form };
    try {
      const f = JSON.parse(featuresJson);
      if (JSON.stringify(f) !== JSON.stringify(plan.features)) input.features = f;
    } catch { /* keep undefined */ }
    try {
      const l = JSON.parse(limitsJson);
      if (JSON.stringify(l) !== JSON.stringify(plan.limits)) input.limits = l;
    } catch { /* keep undefined */ }

    try {
      await updateMutation.mutateAsync({ planId: plan.id, input });
    } catch {
      // Surfaced reactively via `updateMutation.isError`/`error` below.
      return;
    }
    onClose();
  };

  if (!plan) return null;

  const isSubmitting = updateMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t('adminPlansMutations.editPlan')} — ${plan.displayName}`} size="lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.name')}
          <input value={form.name ?? ''} onChange={(e) => update('name', e.target.value)} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.displayName')}
          <input value={form.displayName ?? ''} onChange={(e) => update('displayName', e.target.value)} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.description')}
          <input value={form.description ?? ''} onChange={(e) => update('description', e.target.value)} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.monthlyPrice')}
          <input type="number" min="0" value={form.monthlyPrice ?? 0} onChange={(e) => update('monthlyPrice', Number(e.target.value))} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.yearlyPrice')}
          <input type="number" min="0" value={form.yearlyPrice ?? ''} onChange={(e) => update('yearlyPrice', e.target.value ? Number(e.target.value) : null)} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.sortOrder')}
          <input type="number" value={form.sortOrder ?? 0} onChange={(e) => update('sortOrder', Number(e.target.value))} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex items-center gap-2 font-cairo text-sm">
          <input type="checkbox" checked={form.isActive ?? false} onChange={(e) => update('isActive', e.target.checked)} className="rounded border-border" />
          {t('adminPlansMutations.createModal.isActive')}
        </label>
        <label className="flex items-center gap-2 font-cairo text-sm">
          <input type="checkbox" checked={form.isRecommended ?? false} onChange={(e) => update('isRecommended', e.target.checked)} className="rounded border-border" />
          {t('adminPlansMutations.createModal.isRecommended')}
        </label>
        <div className="col-span-full">
          <label className="flex flex-col gap-1 font-cairo text-sm">
            {t('adminPlansMutations.createModal.features')}
            <textarea value={featuresJson} onChange={(e) => setFeaturesJson(e.target.value)} rows={4} className="w-full rounded-btn border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent" />
          </label>
        </div>
        <div className="col-span-full">
          <label className="flex flex-col gap-1 font-cairo text-sm">
            {t('adminPlansMutations.createModal.limits')}
            <textarea value={limitsJson} onChange={(e) => setLimitsJson(e.target.value)} rows={4} className="w-full rounded-btn border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent" />
          </label>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{t('common:cancel', 'إلغاء')}</Button>
        <Button onClick={handleSubmit} loading={isSubmitting}>
          {isSubmitting ? t('adminPlansMutations.editModal.submitLoading') : t('adminPlansMutations.editModal.submit')}
        </Button>
      </div>
      {updateMutation.isError && (
        <p className="mt-2 font-cairo text-sm text-danger">
          {t('adminPlansMutations.editModal.error')}: {translateApiError(t, updateMutation.error)}
        </p>
      )}
    </Modal>
  );
}
