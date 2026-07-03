import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Info } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import { createLessonSchema, flattenZodErrors } from '@/features/teacher/validation';
import { useUpdateLesson } from '@/features/teacher/hooks/useLessons';
import { useQuizList } from '@/features/teacher/hooks/useQuizList';
import { usePdfUpload } from '@/features/teacher/hooks/usePdfUpload';
import type { Lesson } from '@/features/teacher/types/lesson';
import { EditorHeader } from './EditorHeader';
import { FormActions, LabeledInput, LabeledTextarea } from './EditorFields';
import { YoutubePreview } from './YoutubePreview';
import { PdfDropZone } from './PdfDropZone';
import { PdfFileList } from './PdfFileList';
import type { DeleteTarget } from './types';

function isValidYoutubeUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace('www.', '');
    return ['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host);
  } catch {
    return false;
  }
}

interface LessonEditorFormProps {
  lesson: Lesson;
  onRequestDelete: (target: DeleteTarget) => void;
}

export function LessonEditorForm({ lesson, onRequestDelete }: LessonEditorFormProps) {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const updateLesson = useUpdateLesson();
  const teacherId = useAppSelector((state) => state.auth.user?.id) ?? '';

  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? '');
  const [duration, setDuration] = useState(String(lesson.durationMinutes));
  const [youtubeUrl, setYoutubeUrl] = useState(lesson.youtubeUrl ?? '');
  const [requiredQuizId, setRequiredQuizId] = useState<string>(
    lesson.requiredQuizId ?? '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: publishedQuizzes, isLoading: quizzesLoading } = useQuizList('PUBLISHED');
  const chapterQuizzes = useMemo(
    () =>
      (publishedQuizzes ?? []).filter(
        (q) => q.chapterId === lesson.chapterId && q.status === 'PUBLISHED',
      ),
    [publishedQuizzes, lesson.chapterId],
  );

  const linkedWithoutGate = useMemo(
    () =>
      (lesson.linkedQuizzes ?? []).filter(
        (q) => q.id !== (requiredQuizId || undefined),
      ),
    [lesson.linkedQuizzes, requiredQuizId],
  );

  const pdfUpload = usePdfUpload({
    teacherId,
    lessonId: lesson.id,
    existingKeys: lesson.attachments?.map((a) => a.filePath),
  });

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const reset = () => {
    setTitle(lesson.title);
    setDescription(lesson.description ?? '');
    setDuration(String(lesson.durationMinutes));
    setYoutubeUrl(lesson.youtubeUrl ?? '');
    setRequiredQuizId(lesson.requiredQuizId ?? '');
    setErrors({});
    pdfUpload.clearError();
  };

  const handleSave = () => {
    setErrors({});
    pdfUpload.clearError();

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

    updateLesson.mutate(
      {
        id: lesson.id,
        payload: {
          title: parsed.data.title,
          description: description.trim() || null,
          durationMinutes: parsed.data.durationMinutes,
          youtubeUrl: youtubeUrl.trim() === '' ? null : youtubeUrl.trim(),
          requiredQuizId: requiredQuizId === '' ? null : requiredQuizId,
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

  const isYoutubeUrlValid = isValidYoutubeUrl(youtubeUrl);

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="flex h-full flex-col"
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

      <div className="flex-1 space-y-5 overflow-y-auto pb-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            trailing={
              <span className="font-cairo text-sm text-gray-500">
                {t('contentTree.editor.durationUnit')}
              </span>
            }
          />
        </div>

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

        <div className="flex flex-col gap-1.5">
          <label className="font-cairo text-sm font-medium text-gray-700">
            {t('contentTree.editor.requiredQuiz')}
          </label>
          <p className="font-cairo text-xs text-gray-500">
            {t('contentTree.editor.requiredQuizHint')}
          </p>
          {linkedWithoutGate.length > 0 && !requiredQuizId && (
            <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2">
              <p className="font-cairo text-xs text-warning-800">
                {t('contentTree.editor.linkedQuizOptionalHint', {
                  title: linkedWithoutGate[0]?.title ?? '',
                })}
              </p>
              {linkedWithoutGate.length === 1 && linkedWithoutGate[0] && (
                <button
                  type="button"
                  className="mt-2 font-cairo text-xs font-semibold text-accent underline"
                  onClick={() => setRequiredQuizId(linkedWithoutGate[0]!.id)}
                >
                  {t('contentTree.editor.setLinkedQuizRequired')}
                </button>
              )}
            </div>
          )}
          <select
            value={requiredQuizId}
            onChange={(e) => setRequiredQuizId(e.target.value)}
            className="rounded-input border border-gray-200 px-3 py-2 font-cairo text-sm text-navy-900"
            disabled={quizzesLoading}
          >
            <option value="">{t('contentTree.editor.requiredQuizNone')}</option>
            {quizzesLoading ? (
              <option disabled>{t('contentTree.editor.requiredQuizLoading')}</option>
            ) : (
              chapterQuizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <label className="mb-1.5 block font-cairo text-sm font-medium text-gray-700">
              {t('contentTree.editor.pdfFiles')}
            </label>
            <PdfDropZone
              onFilesSelected={pdfUpload.addFiles}
              disabled={pdfUpload.isUploading}
            />
            {pdfUpload.error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-cairo text-sm text-red-500"
              >
                {pdfUpload.error}
              </motion.p>
            )}
            <PdfFileList
              files={pdfUpload.files}
              onRemove={pdfUpload.removeFile}
            />
          </div>

          <div className="space-y-3">
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
              trailing={
                youtubeUrl.trim() && isYoutubeUrlValid ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : null
              }
            />

            <AnimatePresence>
              {isYoutubeUrlValid && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <YoutubePreview url={youtubeUrl} />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-start gap-2 rounded-lg bg-blue-50 p-3"
            >
              <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
              <p className="font-cairo text-xs leading-relaxed text-blue-700">
                {t('contentTree.editor.youtubeUrlInfo')}
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <FormActions onCancel={reset} saving={updateLesson.isPending || pdfUpload.isUploading} />
      </div>
    </motion.form>
  );
}
