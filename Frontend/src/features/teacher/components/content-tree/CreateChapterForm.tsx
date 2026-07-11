import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import { createChapterSchema, flattenZodErrors } from '@/features/teacher/validation';
import { useCreateChapter } from '@/features/teacher/hooks/useChapters';
import { useTeacherProfile } from '@/features/teacher/hooks/useTeacherProfile';
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
  const { data: teacherProfile } = useTeacherProfile();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [term, setTerm] = useState<'FIRST_TERM' | 'SECOND_TERM'>('FIRST_TERM');
  const [isVisible, setIsVisible] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const reset = () => {
    setName('');
    setDescription('');
    setPrice('');
    setTerm('FIRST_TERM');
    setIsVisible(true);
    setImage(null);
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
      term,
      isVisible,
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
          subject: teacherProfile?.subject ?? undefined,
          sortOrder: nextSortOrder,
          term,
          isVisible,
          image,
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
              message: (error as ApiError)?.message ?? t('contentTree.editor.toast.saveError'),
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
          label={t('contentTree.editor.subject', 'Subject')}
          value={teacherProfile?.subject ?? t('contentTree.editor.subjectLockedEmpty', 'Your approved subject')}
          onChange={() => {}}
          disabled
          helperText={t('contentTree.editor.subjectLocked', 'Subject is locked to your approved teacher profile.')}
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
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-cairo text-sm text-gray-700 file:me-3 file:rounded-md file:border-0 file:bg-cyan-50 file:px-3 file:py-2 file:text-cyan-700"
          />
          {image && (
            <img
              src={URL.createObjectURL(image)}
              alt=""
              className="mt-3 aspect-video w-full rounded-lg object-cover"
            />
          )}
        </div>
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
