import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/shared/components/ui';

const ROW_COUNT = 5;

/**
 * Loading skeleton mirroring LessonActivityTable — same 5 columns, row height,
 * and spacing, so the layout doesn't shift when data arrives. Column headers
 * are translated (for alignment); cells are neutral skeleton blocks.
 */
export function LessonActivityTableSkeleton() {
  const { t } = useTranslation('teacher');

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-100">
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.detail.table.columns.lessonName')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.detail.table.columns.chapter')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.detail.table.columns.video')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.detail.table.columns.pdf')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.detail.table.columns.lastViewed')}
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROW_COUNT }).map((_, i) => (
            <tr key={i} className="border-b border-gray-300">
              {/* Lesson name */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-4 w-40" />
              </td>
              {/* Chapter */}
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </td>
              {/* Video */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-4 w-24" />
              </td>
              {/* PDF */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-4 w-24" />
              </td>
              {/* Last viewed */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-3 w-32" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
