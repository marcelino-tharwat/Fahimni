import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/shared/components/ui';

const ROW_COUNT = 8;

/**
 * Realistic loading skeleton that mirrors the real StudentsTable structure —
 * same columns, row height, and spacing — so the layout doesn't shift when data
 * arrives. Column headers are translated (for alignment); no sort affordances.
 */
export function StudentsTableSkeleton() {
  const { t } = useTranslation('teacher');

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-100">
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.table.columns.name')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.table.columns.phone')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.table.columns.status')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.table.columns.chapters')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.table.columns.lessons')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.table.columns.avgScore')}
            </th>
            <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
              {t('students.table.columns.lastActivity')}
            </th>
            <th className="w-10 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROW_COUNT }).map((_, i) => (
            <tr key={i} className="border-b border-gray-300">
              {/* Name */}
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </td>
              {/* Phone */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-3 w-24" />
              </td>
              {/* Status */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-6 w-14 rounded-badge" />
              </td>
              {/* Chapters */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-4 w-4" />
              </td>
              {/* Lessons */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="mt-1 h-1 w-20 rounded-full" />
              </td>
              {/* Avg score */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-4 w-10" />
              </td>
              {/* Last activity */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-3 w-20" />
              </td>
              {/* Chevron */}
              <td className="px-4 py-3.5">
                <Skeleton className="h-4 w-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
