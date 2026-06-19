import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import { createChapterSchema, flattenZodErrors } from '@/features/teacher/validation';
import { useUpdateChapter } from '@/features/teacher/hooks/useChapters';
import type { Chapter } from '@/features/teacher/types/chapter';
import { EditorHeader } from './EditorHeader';
import { FormActions, LabeledInput, LabeledTextarea } from './EditorFields';
import type { DeleteTarget } from './types';

interface ChapterEditorFormProps {
  chapter: Chapter;
  onRequestDelete: (target: DeleteTarget) => void;
}

export function ChapterEditorForm({ chapter, onRequestDelete }: ChapterEditorFormProps) {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const updateChapter = useUpdateChapter();

  const [name, setName] = useState(chapter.name);
  const [description, setDescription] = useState(chapter.description ?? '');
  const [price, setPrice] = useState(chapter.price != null ? String(chapter.price) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const reset = () => {
    setName(chapter.name);
    setDescription(chapter.description ?? '');
    setPrice(chapter.price != null ? String(chapter.price) : '');
    setErrors({});
  };

  const handleSave = () => {
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

    // sortOrder is intentionally not sent (managed by reorder).
    updateChapter.mutate(
      {
        id: chapter.id,
        payload: { name: parsed.data.name, description: description.trim(), price: priceValue },
      },
      {
        onSuccess: () =>
          dispatch(
            addToast({ type: 'success', message: t('contentTree.editor.toast.chapterSaved') }),
          ),
        onError: (error) =>
          dispatch(
            addToast({
              type: 'error',
              message:
                (error as ApiError)?.message ?? t('contentTree.editor.toast.saveError'),
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
        type="chapter"
        title={t('contentTree.editor.editChapter')}
        onDelete={() =>
          onRequestDelete({
            type: 'chapter',
            id: chapter.id,
            name: chapter.name,
            childrenCount: chapter.lessonsCount,
          })
        }
      />

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

      <FormActions onCancel={reset} saving={updateChapter.isPending} />
    </form>
  );
}
