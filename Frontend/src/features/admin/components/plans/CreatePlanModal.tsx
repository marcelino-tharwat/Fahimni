import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/shared/components/ui';
import { useCreatePlan } from '@/features/admin/hooks/useAdminPlans';
import type { CreatePlanInput } from '@/features/admin/types/plans';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePlanModal({ isOpen, onClose }: CreatePlanModalProps) {
  const { t } = useTranslation();
  const createMutation = useCreatePlan();
  const [form, setForm] = useState<CreatePlanInput>({
    code: '',
    name: '',
    displayName: '',
    description: '',
    monthlyPrice: 0,
    yearlyPrice: null,
    currency: 'EGP',
    isActive: true,
    isRecommended: false,
    sortOrder: 0,
    features: {},
    limits: {},
  });
  const [featuresJson, setFeaturesJson] = useState('{}');
  const [limitsJson, setLimitsJson] = useState('{}');

  const update = (key: keyof CreatePlanInput, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    let features: Record<string, boolean> = {};
    let limits: Record<string, unknown> = {};
    try {
      features = JSON.parse(featuresJson);
    } catch { features = {}; }
    try {
      limits = JSON.parse(limitsJson);
    } catch { limits = {}; }

    await createMutation.mutateAsync({
      ...form,
      monthlyPrice: Number(form.monthlyPrice),
      sortOrder: form.sortOrder != null ? Number(form.sortOrder) : undefined,
      features,
      limits,
    });
    onClose();
    setForm({ code: '', name: '', displayName: '', description: '', monthlyPrice: 0, yearlyPrice: null, currency: 'EGP', isActive: true, isRecommended: false, sortOrder: 0, features: {}, limits: {} });
    setFeaturesJson('{}');
    setLimitsJson('{}');
  };

  const isSubmitting = createMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('adminPlansMutations.createModal.title')} size="lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.code')}
          <input value={form.code} onChange={(e) => update('code', e.target.value.toUpperCase())} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" required />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.name')}
          <input value={form.name} onChange={(e) => update('name', e.target.value)} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" required />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.displayName')}
          <input value={form.displayName} onChange={(e) => update('displayName', e.target.value)} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" required />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.description')}
          <input value={form.description ?? ''} onChange={(e) => update('description', e.target.value)} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.monthlyPrice')}
          <input type="number" min="0" value={form.monthlyPrice} onChange={(e) => update('monthlyPrice', Number(e.target.value))} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" required />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.yearlyPrice')}
          <input type="number" min="0" value={form.yearlyPrice ?? ''} onChange={(e) => update('yearlyPrice', e.target.value ? Number(e.target.value) : null)} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.currency')}
          <input value={form.currency} onChange={(e) => update('currency', e.target.value)} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminPlansMutations.createModal.sortOrder')}
          <input type="number" value={form.sortOrder} onChange={(e) => update('sortOrder', Number(e.target.value))} className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex items-center gap-2 font-cairo text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} className="rounded border-border" />
          {t('adminPlansMutations.createModal.isActive')}
        </label>
        <label className="flex items-center gap-2 font-cairo text-sm">
          <input type="checkbox" checked={form.isRecommended} onChange={(e) => update('isRecommended', e.target.checked)} className="rounded border-border" />
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
          {isSubmitting ? t('adminPlansMutations.createModal.submitLoading') : t('adminPlansMutations.createModal.submit')}
        </Button>
      </div>
      {createMutation.isError && (
        <p className="mt-2 font-cairo text-sm text-danger">
          {t('adminPlansMutations.createModal.error')}: {createMutation.error?.message}
        </p>
      )}
    </Modal>
  );
}
