import { useTranslation } from 'react-i18next';
import { Play, FileText, Clock } from 'lucide-react';
import { Badge, Button, Card } from '@/shared/components/ui';
import { mockLessons } from '@/shared/mocks/content';

const lesson = mockLessons[0]!;

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function LessonPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Video placeholder (16:9) */}
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-card bg-gray-200">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40">
          <Play size={28} className="text-white" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-cairo text-2xl font-bold text-text-primary">{lesson.title}</h1>
          <Badge variant="info">
            <Clock size={14} className="me-1 inline" />
            {lesson.duration} دقيقة
          </Badge>
        </div>
        <p className="font-cairo text-text-secondary">{lesson.description}</p>
      </div>

      {/* Attachments */}
      <Card padding="md" className="flex flex-col gap-3">
        <h2 className="font-cairo text-base font-semibold text-text-primary">الملفات المرفقة</h2>
        {lesson.attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between gap-3 rounded-input border border-border p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <FileText size={20} className="shrink-0 text-accent" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-cairo text-sm text-text-primary">
                  {attachment.fileName}
                </span>
                <span className="font-cairo text-xs text-text-secondary">
                  {formatFileSize(attachment.fileSize)}
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm">
              {t('student:downloadPdf')}
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
