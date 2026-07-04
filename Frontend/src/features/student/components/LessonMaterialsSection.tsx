import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import {
  downloadLessonMaterial,
  previewLessonMaterial,
  triggerBlobDownload,
  type StudentLessonMaterial,
} from '@/features/student/api/materials';

interface LessonMaterialsSectionProps {
  materials: StudentLessonMaterial[];
  lessonId: string;
  onMaterialDownloaded?: (materialId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${toLocalNum(parseFloat(mb.toFixed(1)))} MB`;
  const kb = bytes / 1024;
  return `${toLocalNum(Math.round(kb))} KB`;
}

function MaterialStatusLabel({
  material,
  downloading,
  error,
}: {
  material: StudentLessonMaterial;
  downloading: boolean;
  error: string | null;
}) {
  const { t } = useTranslation('student');

  if (error) {
    return (
      <span className="font-cairo text-xs text-red-600">{t('lesson.materials.status.error')}</span>
    );
  }
  if (downloading) {
    return (
      <span className="font-cairo text-xs text-gray-500">{t('lesson.materials.status.downloading')}</span>
    );
  }
  if (!material.canDownload) {
    return (
      <span className="font-cairo text-xs text-gray-400">{t('lesson.materials.status.unavailable')}</span>
    );
  }
  if (material.hasDownloaded) {
    return (
      <span className="font-cairo text-xs text-success-600">
        {material.firstDownloadedAt
          ? t('lesson.materials.status.downloadedAt', {
              date: new Date(material.firstDownloadedAt).toLocaleDateString(),
            })
          : t('lesson.materials.status.downloaded')}
      </span>
    );
  }
  return (
    <span className="font-cairo text-xs text-gray-500">{t('lesson.materials.status.notDownloaded')}</span>
  );
}

function MaterialRow({
  material,
  onDownloaded,
}: {
  material: StudentLessonMaterial;
  onDownloaded?: (materialId: string) => void;
}) {
  const { t } = useTranslation('student');
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    if (!material.canDownload || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await downloadLessonMaterial(material.id);
      triggerBlobDownload(blob, filename);
      onDownloaded?.(material.id);
    } catch {
      setError(t('lesson.materials.status.error'));
    } finally {
      setDownloading(false);
    }
  }, [material.canDownload, material.id, downloading, onDownloaded, t]);

  const handlePreview = useCallback(async () => {
    if (!material.canPreview || previewing) return;
    setPreviewing(true);
    setError(null);
    try {
      await previewLessonMaterial(material.id);
    } catch {
      setError(t('lesson.materials.status.previewError'));
    } finally {
      setPreviewing(false);
    }
  }, [material.canPreview, material.id, previewing, t]);

  return (
    <div
      className="flex flex-col gap-3 rounded-input border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid={`lesson-material-row-${material.id}`}
    >
      <div className="flex min-w-0 items-start gap-3 sm:flex-1">
        <FileText size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-cairo text-sm font-medium text-navy-900">
            {material.displayName}
          </span>
          <span className="font-cairo text-xs text-gray-400">
            {formatFileSize(material.fileSize)}
          </span>
          <MaterialStatusLabel material={material} downloading={downloading} error={error} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {material.canPreview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={previewing}
            disabled={downloading}
            onClick={() => void handlePreview()}
            className="min-h-[44px] font-cairo"
          >
            <Eye size={16} className="me-1.5" />
            {t('lesson.materials.preview')}
          </Button>
        )}
        {material.canDownload && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={downloading}
            disabled={previewing}
            onClick={() => void handleDownload()}
            className="min-h-[44px] font-cairo"
          >
            {t('lesson.download')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function LessonMaterialsSection({
  materials,
  lessonId,
  onMaterialDownloaded,
}: LessonMaterialsSectionProps) {
  const { t } = useTranslation('student');

  if (materials.length === 0) {
    return (
      <div
        className="flex items-center gap-2 rounded-card border border-dashed border-border bg-surface px-4 py-6 font-cairo text-sm text-gray-500"
        data-testid="lesson-materials-empty"
      >
        <AlertCircle size={18} className="shrink-0 text-gray-400" />
        {t('lesson.materials.empty')}
      </div>
    );
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-card border border-gray-200 bg-surface p-4 shadow-lg"
      aria-labelledby={`lesson-materials-title-${lessonId}`}
    >
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <FileText size={20} className="text-accent" aria-hidden />
        <h2
          id={`lesson-materials-title-${lessonId}`}
          className="font-cairo text-base font-semibold text-navy-900"
        >
          {t('lesson.pdfMaterials')}
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {materials.map((material) => (
          <MaterialRow
            key={material.id}
            material={material}
            onDownloaded={onMaterialDownloaded}
          />
        ))}
      </div>

      <div className="border-t border-border pt-3 font-cairo text-xs text-gray-500">
        {t('lesson.totalFiles', { n: toLocalNum(materials.length) })}
      </div>
    </section>
  );
}
