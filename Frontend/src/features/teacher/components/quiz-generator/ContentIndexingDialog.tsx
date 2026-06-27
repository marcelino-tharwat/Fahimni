import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Modal, Button, Badge, Spinner } from '@/shared/components/ui';
import { useIndexStatus, useIndexLesson } from '@/features/teacher/hooks/useContentIndexing';

interface LessonRef {
  id: string;
  title: string;
}

interface ContentIndexingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lessons: LessonRef[];
}

/**
 * Teacher dialog to index lesson content (RAG) so AI quiz generation has source
 * material. One row per lesson: shows live status and, when not ready, lets the
 * teacher paste the lesson text and index it. Real endpoints only — no mocks.
 */
export function ContentIndexingDialog({ isOpen, onClose, lessons }: ContentIndexingDialogProps) {
  const { t } = useTranslation();
  const tk = (k: string, o?: Record<string, unknown>) => t(`teacher:quizGenerator.indexing.${k}`, o);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tk('title')} size="lg">
      <div className="flex flex-col gap-4">
        <p className="font-cairo text-sm text-text-secondary">{tk('description')}</p>

        {lessons.length === 0 ? (
          <p className="font-cairo text-sm text-text-secondary">{tk('noLessons')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {lessons.map((lesson) => (
              <IndexRow key={lesson.id} lesson={lesson} active={isOpen} />
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            {tk('close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function IndexRow({ lesson, active }: { lesson: LessonRef; active: boolean }) {
  const { t } = useTranslation();
  const tk = (k: string, o?: Record<string, unknown>) => t(`teacher:quizGenerator.indexing.${k}`, o);
  const { data: status, isLoading } = useIndexStatus(lesson.id, active);
  const indexLesson = useIndexLesson();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isReady = status?.status === 'ready' && status.chunkCount > 0;

  const handleIndex = () => {
    setError(null);
    if (text.trim().length === 0) {
      setError(tk('contentRequired'));
      return;
    }
    indexLesson.mutate(
      { lessonId: lesson.id, pdfText: text.trim() },
      {
        onSuccess: () => setText(''),
        onError: () => setError(tk('indexError')),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-cairo text-sm font-semibold text-text-primary">{lesson.title}</span>
        {isLoading ? (
          <span className="flex items-center gap-1 font-cairo text-xs text-text-secondary">
            <Loader2 size={14} className="animate-spin" />
            {tk('checking')}
          </span>
        ) : isReady ? (
          <Badge variant="success">
            {tk('ready', { count: status?.chunkCount ?? 0 })}
          </Badge>
        ) : status?.status === 'failed' ? (
          <Badge variant="danger">{tk('failed')}</Badge>
        ) : (
          <Badge variant="warning">{tk('notReady')}</Badge>
        )}
      </div>

      {isReady ? (
        <p className="flex items-center gap-1 font-cairo text-xs text-success">
          <CheckCircle2 size={14} />
          {tk('indexedHint')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={tk('contentPlaceholder')}
            className="rounded-button border border-border bg-surface p-3 font-cairo text-sm text-text-primary"
            aria-label={t('teacher:quizGenerator.indexing.contentLabel', { title: lesson.title })}
            disabled={indexLesson.isPending}
          />
          {error && (
            <span className="flex items-center gap-1 font-cairo text-xs text-danger" role="alert">
              <AlertCircle size={14} />
              {error}
            </span>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={handleIndex} disabled={indexLesson.isPending}>
              {indexLesson.isPending ? (
                <>
                  <Spinner size="sm" />
                  {tk('indexing')}
                </>
              ) : (
                tk('indexButton')
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
