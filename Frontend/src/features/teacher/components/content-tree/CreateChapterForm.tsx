import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import { createChapterSchema, flattenZodErrors } from '@/features/teacher/validation';
import { useCreateChapter } from '@/features/teacher/hooks/useChapters';
import { EditorHeader } from './EditorHeader';
import { FormActions, LabeledInput, LabeledTextarea } from './EditorFields';
import type { NodeRef } from './types';

interface CreateChapterFormProps {
  parentStageId: string;
  /** Auto-calculated (existing chapters + 1); never shown in the form. */
  nextSortOrder: number;
  onCreated: (item: NodeRef) => void;
}

export function CreateChapterForm({
  parentStageId,
  nextSortOrder,
  onCreated,
}: CreateChapterFormProps) {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const createChapter = useCreateChapter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const reset = () => {
    setName('');
    setDescription('');
    setPrice('');
    setErrors({});
  };

  const handleCreate = () => {
    setErrors({});
    // Empty/cleared price = null (free chapter); otherwise a number.
    const priceValue = price.trim() === '' ? null : Number(price);

    const parsed = createChapterSchema(t).safeParse({
      name: name.trim(),
      description: description.trim(),
      price: priceValue,
    });
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }

    createChapter.mutate(
      {
        stageId: parentStageId,
        payload: {
          name: parsed.data.name,
          description: description.trim() || undefined,
          price: priceValue ?? undefined,
          sortOrder: nextSortOrder,
        },
      },
      {
        onSuccess: (created) => {
          dispatch(
            addToast({ type: 'success', message: t('contentTree.editor.toast.chapterCreated') }),
          );
          onCreated({ type: 'chapter', id: created.id });
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
    >
      <EditorHeader type="chapter" title={t('contentTree.newChapter')} />

      <div className="space-y-5">
        <LabeledInput
          label={t('contentTree.editor.chapterName')}
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
        <LabeledInput
          label={t('contentTree.editor.price')}
          optional
          type="number"
          inputMode="numeric"
          dir="ltr"
          value={price}
          onChange={(v) => {
            setPrice(v);
            clearError('price');
          }}
          error={errors.price}
          helperText={t('contentTree.editor.priceHint')}
          trailing={
            <span className="font-cairo text-sm text-gray-500">
              {t('contentTree.editor.egp')}
            </span>
          }
        />
      </div>

      <FormActions
        onCancel={reset}
        saving={createChapter.isPending}
        submitLabel={t('common:actions.create')}
        submittingLabel={t('contentTree.editor.creating')}
      />
    </form>
  );
}
