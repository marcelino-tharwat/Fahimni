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
  const [term, setTerm] = useState<'FIRST_TERM' | 'SECOND_TERM'>(chapter.term ?? 'FIRST_TERM');
  const [isVisible, setIsVisible] = useState(chapter.isVisible ?? true);
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const reset = () => {
    setName(chapter.name);
    setDescription(chapter.description ?? '');
    setPrice(chapter.price != null ? String(chapter.price) : '');
    setTerm(chapter.term ?? 'FIRST_TERM');
    setIsVisible(chapter.isVisible ?? true);
    setImage(null);
    setRemoveImage(false);
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
      term,
      isVisible,
    });
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }

    // sortOrder is intentionally not sent (managed by reorder).
    updateChapter.mutate(
      {
        id: chapter.id,
        payload: {
          name: parsed.data.name,
          description: description.trim(),
          price: priceValue,
          term,
          isVisible,
          image,
          removeImage,
        },
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
        <div>
          <label className="mb-1 block font-cairo text-sm font-semibold text-navy-800">
            {t('contentTree.editor.term', 'Term')}
          </label>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value as 'FIRST_TERM' | 'SECOND_TERM')}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 font-cairo text-sm text-gray-700 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          >
            <option value="FIRST_TERM">{t('contentTree.editor.firstTerm', 'First Term')}</option>
            <option value="SECOND_TERM">{t('contentTree.editor.secondTerm', 'Second Term')}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-cairo text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
            className="h-4 w-4 accent-cyan-600"
          />
          {t('contentTree.editor.visibleToStudents', 'Visible to students')}
        </label>
        <div>
          <label className="mb-1 block font-cairo text-sm font-semibold text-navy-800">
            {t('contentTree.editor.chapterImage', 'Chapter image')}
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              setImage(e.target.files?.[0] ?? null);
              setRemoveImage(false);
            }}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-cairo text-sm text-gray-700 file:me-3 file:rounded-md file:border-0 file:bg-cyan-50 file:px-3 file:py-2 file:text-cyan-700"
          />
          {(image || (chapter.imageUrl && !removeImage)) && (
            <div className="mt-3">
              <img
                src={image ? URL.createObjectURL(image) : chapter.imageUrl ?? undefined}
                alt=""
                className="aspect-video w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setRemoveImage(true);
                }}
                className="mt-2 font-cairo text-sm font-semibold text-danger-500"
              >
                {t('contentTree.editor.removeImage', 'Remove image')}
              </button>
            </div>
          )}
        </div>
      </div>

      <FormActions onCancel={reset} saving={updateChapter.isPending} />
    </form>
  );
}
