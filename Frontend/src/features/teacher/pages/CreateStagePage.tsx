import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import { createStageUpdateSchema, flattenZodErrors } from '@/features/teacher/validation';
import { useCreateStage } from '@/features/teacher/hooks/useStages';
import { EditorHeader } from '@/features/teacher/components/content-tree/EditorHeader';
import {
  FormActions,
  LabeledInput,
  LabeledTextarea,
} from '@/features/teacher/components/content-tree/EditorFields';

export function CreateStagePage() {
  const { t } = useTranslation('teacher');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const createStage = useCreateStage();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const goBack = () => navigate('/teacher/content');

  const handleCreate = () => {
    setErrors({});
    // Stage create only needs name + description; sortOrder is auto-assigned by
    // the backend (the schema/payload deliberately omit it).
    const parsed = createStageUpdateSchema(t).safeParse({
      name: name.trim(),
      description: description.trim(),
    });
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }

    createStage.mutate(
      { name: parsed.data.name, description: description.trim() || undefined },
      {
        onSuccess: () => {
          dispatch(
            addToast({ type: 'success', message: t('contentTree.editor.toast.stageCreated') }),
          );
          goBack();
        },
        onError: (error) =>
          dispatch(
            addToast({
              type: 'error',
              message: translateApiError(t, error),
            }),
          ),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back button */}
      <button
        type="button"
        onClick={goBack}
        className="mb-4 flex items-center gap-1.5 font-cairo text-sm font-medium text-navy-600 transition-colors hover:text-navy-900"
      >
        <ArrowLeft size={18} />
        {t('common:actions.back')}
      </button>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('stages.newStage')}</h1>
      </div>

      {/* Form card — matches the content-tree editor panel styling */}
      <div className="rounded-card border border-border bg-surface p-4 shadow-sm md:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <EditorHeader type="stage" title={t('stages.newStage')} />

          <div className="space-y-5">
            <LabeledInput
              label={t('contentTree.editor.stageName')}
              required
              value={name}
              maxLength={200}
              onChange={(v) => {
                setName(v);
                clearError('name');
              }}
              error={errors.name}
            />
            <LabeledTextarea
              label={t('contentTree.editor.description')}
              optional
              value={description}
              onChange={(v) => {
                setDescription(v);
                clearError('description');
              }}
              error={errors.description}
            />
          </div>

          <FormActions
            onCancel={goBack}
            saving={createStage.isPending}
            submitLabel={t('common:actions.create')}
            submittingLabel={t('contentTree.editor.creating')}
          />
        </form>
      </div>
    </div>
  );
}
