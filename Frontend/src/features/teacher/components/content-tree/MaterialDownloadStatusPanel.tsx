import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Users, Download, AlertCircle } from 'lucide-react';
import { fetchMaterialDownloadStatuses } from '@/features/teacher/api/materials';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';

interface MaterialDownloadStatusPanelProps {
  materialId: string;
  displayName: string;
}

export function MaterialDownloadStatusPanel({
  materialId,
  displayName,
}: MaterialDownloadStatusPanelProps) {
  const { t } = useTranslation('teacher');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher', 'material-download-status', materialId],
    queryFn: () => fetchMaterialDownloadStatuses(materialId),
  });

  if (isLoading) {
    return (
      <p className="font-cairo text-xs text-gray-400">{t('contentTree.editor.materialStatus.loading')}</p>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 font-cairo text-xs text-red-600">
        <AlertCircle size={14} />
        {t('contentTree.editor.materialStatus.error')}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2 font-cairo text-xs font-medium text-navy-900">
        <Download size={14} className="text-accent" />
        {t('contentTree.editor.materialStatus.title', { name: displayName })}
      </div>
      <div className="mb-3 flex flex-wrap gap-3 font-cairo text-xs text-gray-600">
        <span className="inline-flex items-center gap-1">
          <Users size={12} />
          {t('contentTree.editor.materialStatus.enrolled', {
            n: toLocalNum(data.summary.enrolledStudentCount),
          })}
        </span>
        <span>
          {t('contentTree.editor.materialStatus.downloaded', {
            n: toLocalNum(data.summary.downloadedCount),
          })}
        </span>
        <span>
          {t('contentTree.editor.materialStatus.notDownloaded', {
            n: toLocalNum(data.summary.notDownloadedCount),
          })}
        </span>
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {data.students.map((student) => (
          <li
            key={student.studentId}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 bg-white px-2 py-1.5 font-cairo text-xs"
          >
            <span className="font-medium text-navy-900">{student.studentName}</span>
            <span className={student.hasDownloaded ? 'text-green-600' : 'text-gray-500'}>
              {student.hasDownloaded
                ? t('contentTree.editor.materialStatus.studentDownloaded')
                : t('contentTree.editor.materialStatus.studentNotDownloaded')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
