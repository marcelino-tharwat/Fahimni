import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/shared/components/ui';
import { Spinner } from '@/shared/components/ui/Spinner';
import { translateApiError } from '@/shared/lib/api/translateError';
import { normalizeTextInput } from '@/shared/lib/utils/textNormalization';
import { adminStagesApi } from '@/features/admin/api/adminStages';
import { useAdminUpdateStudent } from '@/features/admin/hooks/useAdminStudents';
import type { StudentIdentity, AdminStudentUpdatePayload } from '@/features/admin/types/students';
import type { AdminStage } from '@/features/admin/api/adminStages';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentIdentity | null;
}

export function EditStudentModal({ isOpen, onClose, student }: EditStudentModalProps) {
  const { t } = useTranslation();
  const updateMutation = useAdminUpdateStudent();
  const [form, setForm] = useState<AdminStudentUpdatePayload>({});
  const [stages, setStages] = useState<AdminStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (student) {
      setForm({
        fullName: student.fullName,
        email: student.email ?? '',
        mobile: student.mobile,
        status: student.status,
        stageId: student.stage?.id ?? '',
      });
    }
  }, [student]);

  useEffect(() => {
    if (isOpen) {
      setStagesLoading(true);
      adminStagesApi.list()
        .then((res) => setStages(res.data.filter((s) => s.isActive)))
        .catch(() => setStages([]))
        .finally(() => setStagesLoading(false));
    }
  }, [isOpen]);

  const update = (key: keyof AdminStudentUpdatePayload, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!student) return;

    const fieldErrors: Record<string, string> = {};
    if (!form.fullName || form.fullName.trim().length < 2) {
      fieldErrors.fullName = t('validation:tooShort');
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      fieldErrors.email = t('validation:emailInvalid');
    }
    if (form.mobile && !/^01[0-9]{9}$/.test(form.mobile)) {
      fieldErrors.mobile = t('validation:mobileInvalid');
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const payload: AdminStudentUpdatePayload = {};
    if (form.fullName !== undefined && form.fullName !== student.fullName) {
      payload.fullName = normalizeTextInput(form.fullName);
    }
    if (form.email !== undefined && form.email !== (student.email ?? '')) {
      payload.email = form.email || undefined;
    }
    if (form.mobile !== undefined && form.mobile !== student.mobile) {
      payload.mobile = form.mobile;
    }
    if (form.status !== undefined && form.status !== student.status) {
      payload.status = form.status;
    }
    if (form.stageId !== undefined && form.stageId !== (student.stage?.id ?? '')) {
      payload.stageId = form.stageId || undefined;
    }

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    try {
      await updateMutation.mutateAsync({ studentId: student.id, payload });
    } catch {
      return;
    }
    onClose();
  };

  if (!student) return null;

  const isSubmitting = updateMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('adminStudents.edit.title', 'تعديل بيانات الطالب')} size="lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminStudents.edit.fullName', 'الاسم الكامل')}
          <input
            value={form.fullName ?? ''}
            onChange={(e) => update('fullName', e.target.value)}
            className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
          />
          {errors.fullName && <span className="text-xs text-danger">{errors.fullName}</span>}
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminStudents.edit.mobile', 'رقم الجوال')}
          <input
            value={form.mobile ?? ''}
            onChange={(e) => update('mobile', e.target.value)}
            className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
          />
          {errors.mobile && <span className="text-xs text-danger">{errors.mobile}</span>}
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminStudents.edit.email', 'البريد الإلكتروني')}
          <input
            value={form.email ?? ''}
            onChange={(e) => update('email', e.target.value)}
            className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
          />
          {errors.email && <span className="text-xs text-danger">{errors.email}</span>}
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm">
          {t('adminStudents.edit.status', 'الحالة')}
          <select
            value={form.status ?? student.status}
            onChange={(e) => update('status', e.target.value)}
            className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
          >
            <option value="ACTIVE">{t('adminStudents.status.ACTIVE', 'نشط')}</option>
            <option value="INACTIVE">{t('adminStudents.status.INACTIVE', 'غير نشط')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-cairo text-sm sm:col-span-2">
          {t('adminStudents.edit.stage', 'المرحلة الدراسية')}
          {stagesLoading ? (
            <div className="flex h-10 items-center"><Spinner /></div>
          ) : (
            <select
              value={form.stageId ?? ''}
              onChange={(e) => update('stageId', e.target.value)}
              className="h-10 rounded-btn border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
            >
              <option value="">{t('adminStudents.edit.noStage', 'بدون مرحلة')}</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.displayName ?? stage.name}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{t('adminStudents.edit.cancel', 'إلغاء')}</Button>
        <Button onClick={handleSubmit} loading={isSubmitting}>
          {isSubmitting ? t('adminStudents.edit.saving', 'جاري الحفظ...') : t('adminStudents.edit.save', 'حفظ التعديلات')}
        </Button>
      </div>
      {updateMutation.isError && (
        <p className="mt-2 font-cairo text-sm text-danger">
          {translateApiError(t, updateMutation.error)}
        </p>
      )}
    </Modal>
  );
}
