import { useCallback, useState } from 'react';
import { useTranslation, type TFunction } from 'react-i18next';
import { Eye, FileText, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import {
  downloadLessonMaterial,
  triggerBlobDownload,
  type StudentLessonMaterial,
} from '@/features/student/api/materials';
import { PdfProtectedViewer } from '@/shared/components/content-protection';

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

function getStatusLabel(
  material: StudentLessonMaterial,
  downloading: boolean,
  error: string | null,
  t: TFunction,
): string {
  if (error) return t('lesson.materials.status.error');
  if (downloading) return t('lesson.materials.status.downloading');
  if (!material.canDownload) return t('lesson.materials.status.unavailable');
  if (material.hasDownloaded) {
    return material.firstDownloadedAt
      ? t('lesson.materials.status.downloadedAt', {
          date: new Date(material.firstDownloadedAt).toLocaleDateString(),
        })
      : t('lesson.materials.status.downloaded');
  }
  return t('lesson.materials.status.notDownloaded');
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
  const [showPreview, setShowPreview] = useState(false);
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

  const handlePreview = useCallback(() => {
    if (!material.canPreview) return;
    setShowPreview((prev) => !prev);
  }, [material.canPreview]);

  return (
    <>
      <div
        className="flex items-center gap-x-3 rounded-card p-2 transition hover:bg-gray-100"
        data-testid={`lesson-material-row-${material.id}`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-cyan-50">
          <FileText size={20} className="text-cyan-700" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-gray-900">
            {material.displayName}
          </p>
          <p className="truncate text-small text-gray-500">
            {formatFileSize(material.fileSize)}
            <span> · </span>
            {getStatusLabel(material, downloading, error, t)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {material.canPreview && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading}
              onClick={handlePreview}
              className="h-9 min-h-0 border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Eye size={16} />
              {showPreview ? t('lesson.materials.closePreview', { defaultValue: 'إغلاق' }) : t('lesson.materials.preview')}
            </Button>
          )}
          {material.canDownload && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={downloading}
              disabled={showPreview}
              onClick={() => void handleDownload()}
              className="h-9 min-h-0 bg-cyan-500 text-white hover:bg-cyan-600"
            >
              <Download size={16} />
              {t('lesson.download')}
            </Button>
          )}
        </div>
      </div>
      {showPreview && (
        <div className="mt-4">
          <PdfProtectedViewer materialId={material.id} />
        </div>
      )}
    </>
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
      className="overflow-hidden rounded-card border border-gray-200 bg-white shadow-card"
      aria-labelledby={`lesson-materials-title-${lessonId}`}
    >
      <div className="flex items-center gap-2 border-b border-gray-200 p-4">
        <FileText size={20} className="text-gray-600" aria-hidden />
        <h2
          id={`lesson-materials-title-${lessonId}`}
          className="font-cairo text-base font-semibold text-navy-900"
        >
          {t('lesson.fileCount', { count: materials.length })}
        </h2>
      </div>

      <div className="divide-y divide-gray-200">
        {materials.map((material) => (
          <div key={material.id} className="p-2">
            <MaterialRow
              material={material}
              onDownloaded={onMaterialDownloaded}
            />
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 p-4 font-cairo text-xs text-gray-500">
        {t('lesson.totalFiles', { n: toLocalNum(materials.length) })}
      </div>
    </section>
  );
}
