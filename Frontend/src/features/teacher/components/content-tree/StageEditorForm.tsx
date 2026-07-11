import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import { createStageUpdateSchema, flattenZodErrors } from '@/features/teacher/validation';
import { useUpdateStage } from '@/features/teacher/hooks/useStages';
import type { StageResponseDTO } from '@/features/teacher/types/stage';
import { EditorHeader } from './EditorHeader';
import { FormActions, LabeledInput, LabeledTextarea } from './EditorFields';
import type { DeleteTarget } from './types';

interface StageEditorFormProps {
  stage: StageResponseDTO;
  onRequestDelete: (target: DeleteTarget) => void;
}

export function StageEditorForm({ stage, onRequestDelete }: StageEditorFormProps) {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const updateStage = useUpdateStage();

  const [name, setName] = useState(stage.name);
  const [description, setDescription] = useState(stage.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const reset = () => {
    setName(stage.name);
    setDescription(stage.description ?? '');
    setErrors({});
  };

  const handleSave = () => {
    setErrors({});
    const parsed = createStageUpdateSchema(t).safeParse({
      name: name.trim(),
      description: description.trim(),
    });
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }

    // sortOrder is intentionally not sent (managed by reorder).
    updateStage.mutate(
      { id: stage.id, payload: { name: parsed.data.name, description: description.trim() } },
      {
        onSuccess: () =>
          dispatch(
            addToast({ type: 'success', message: t('contentTree.editor.toast.stageSaved') }),
          ),
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <EditorHeader
        type="stage"
        title={t('contentTree.editor.editStage')}
        onDelete={() =>
          onRequestDelete({
            type: 'stage',
            id: stage.id,
            name: stage.name,
            childrenCount: stage.chapterCount,
          })
        }
      />

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

      <FormActions onCancel={reset} saving={updateStage.isPending} />
    </form>
  );
}
