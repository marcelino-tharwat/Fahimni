import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Info } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import { createLessonSchema, flattenZodErrors } from '@/features/teacher/validation';
import { useCreateLesson } from '@/features/teacher/hooks/useLessons';
import { usePdfUpload } from '@/features/teacher/hooks/usePdfUpload';
import { EditorHeader } from './EditorHeader';
import { FormActions, LabeledInput, LabeledTextarea } from './EditorFields';
import { YoutubePreview } from './YoutubePreview';
import { PdfDropZone } from './PdfDropZone';
import { PdfFileList } from './PdfFileList';
import type { NodeRef } from './types';

interface CreateLessonFormProps {
  parentChapterId: string;
  /** Auto-calculated (existing lessons + 1); never shown in the form. */
  nextSortOrder: number;
  onCreated: (item: NodeRef) => void;
  /** Expand the parent chapter so the new lesson is visible in the tree. */
  onExpandParent: () => void;
}

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

export function CreateLessonForm({
  parentChapterId,
  nextSortOrder,
  onCreated,
  onExpandParent,
}: CreateLessonFormProps) {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const teacherId = useAppSelector((state) => state.auth.user?.id) ?? '';
  const createLesson = useCreateLesson();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  const pdfUpload = usePdfUpload({
    teacherId,
    uploadImmediately: true,
    staging: true,
  });

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const reset = () => {
    setTitle('');
    setDescription('');
    setDuration('');
    setYoutubeUrl('');
    setErrors({});
    pdfUpload.clearError();
  };

  const handleCreate = async () => {
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

    setIsCreating(true);

    try {
      const created = await createLesson.mutateAsync({
        chapterId: parentChapterId,
        payload: {
          title: parsed.data.title,
          description: description.trim() || undefined,
          durationMinutes: parsed.data.durationMinutes,
          youtubeUrl: youtubeUrl.trim() || undefined,
          sortOrder: nextSortOrder,
        },
      });

      await pdfUpload.startUpload(created.id);

      dispatch(
        addToast({ type: 'success', message: t('contentTree.editor.toast.lessonCreated') }),
      );
      onExpandParent();
      onCreated({ type: 'lesson', id: created.id });
    } catch (error) {
      dispatch(
        addToast({
          type: 'error',
          message: translateApiError(t, error),
        }),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const isYoutubeUrlValid = isValidYoutubeUrl(youtubeUrl);
  const isSaving = createLesson.isPending || pdfUpload.isUploading || isCreating;

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      onSubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
      className="flex h-full flex-col"
    >
      <EditorHeader type="lesson" title={t('contentTree.newLesson')} />

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
        <FormActions
          onCancel={reset}
          saving={isSaving}
          submitLabel={t('common:actions.create')}
          submittingLabel={t('contentTree.editor.creating')}
        />
      </div>
    </motion.form>
  );
}
