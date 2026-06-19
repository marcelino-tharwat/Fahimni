import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import { createLessonSchema, flattenZodErrors } from '@/features/teacher/validation';
import { useUpdateLesson } from '@/features/teacher/hooks/useLessons';
import type { Lesson } from '@/features/teacher/types/lesson';
import { EditorHeader } from './EditorHeader';
import { FormActions, LabeledInput, LabeledTextarea } from './EditorFields';
import type { DeleteTarget } from './types';

interface LessonEditorFormProps {
  lesson: Lesson;
  onRequestDelete: (target: DeleteTarget) => void;
}

export function LessonEditorForm({ lesson, onRequestDelete }: LessonEditorFormProps) {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const updateLesson = useUpdateLesson();

  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? '');
  const [duration, setDuration] = useState(String(lesson.durationMinutes));
  const [youtubeUrl, setYoutubeUrl] = useState(lesson.youtubeUrl ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const reset = () => {
    setTitle(lesson.title);
    setDescription(lesson.description ?? '');
    setDuration(String(lesson.durationMinutes));
    setYoutubeUrl(lesson.youtubeUrl ?? '');
    setErrors({});
  };

  const handleSave = () => {
    setErrors({});
    const parsed = createLessonSchema(t).safeParse({
      title: title.trim(),
      description: description.trim(),
      durationMinutes: duration.trim() === '' ? NaN : Number(duration),
      youtubeUrl: youtubeUrl.trim(),
    });
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }

    // sortOrder and pdfUrls are intentionally not sent here.
    updateLesson.mutate(
      {
        id: lesson.id,
        payload: {
          title: parsed.data.title,
          description: description.trim(),
          durationMinutes: parsed.data.durationMinutes,
          youtubeUrl: youtubeUrl.trim() === '' ? null : youtubeUrl.trim(),
        },
      },
      {
        onSuccess: () =>
          dispatch(
            addToast({ type: 'success', message: t('contentTree.editor.toast.lessonSaved') }),
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
        type="lesson"
        title={t('contentTree.editor.editLesson')}
        onDelete={() =>
          onRequestDelete({
            type: 'lesson',
            id: lesson.id,
            name: lesson.title,
            childrenCount: 0,
          })
        }
      />

      <div className="space-y-5">
        <LabeledInput
          label={t('contentTree.editor.lessonTitle')}
          required
          value={title}
          maxLength={200}
          onChange={(v) => {
            setTitle(v);
            clearError('title');
          }}
          error={errors.title}
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
          label={t('contentTree.editor.duration')}
          required
          type="number"
          inputMode="numeric"
          dir="ltr"
          value={duration}
          onChange={(v) => {
            setDuration(v);
            clearError('durationMinutes');
          }}
          error={errors.durationMinutes}
        />
        <LabeledInput
          label={t('contentTree.editor.youtubeUrl')}
          optional
          type="text"
          dir="ltr"
          value={youtubeUrl}
          onChange={(v) => {
            setYoutubeUrl(v);
            clearError('youtubeUrl');
          }}
          error={errors.youtubeUrl}
          placeholder="https://youtube.com/watch?v=..."
        />

        {/* PDF Files — placeholder (upload implemented in a later step) */}
        <div>
          <label className="mb-1.5 block font-cairo text-sm font-medium text-gray-700">
            {t('contentTree.editor.pdfFiles')}
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4">
            <FileText size={18} className="text-gray-400" />
            <span className="font-cairo text-sm text-gray-400">
              {t('contentTree.editor.pdfComingSoon')}
            </span>
          </div>
        </div>
      </div>

      <FormActions onCancel={reset} saving={updateLesson.isPending} />
    </form>
  );
}
