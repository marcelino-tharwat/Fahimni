import { useTranslation } from 'react-i18next';
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { Avatar, Badge } from '@/shared/components/ui';
import {
  localizeDigits,
  formatRelativeTime,
  getLessonProgressColorClass,
  getQuizScoreColorClasses,
} from '@/features/teacher/lib/studentEngagementPresentation';
import type {
  TeacherStudentRow,
  TeacherStudentsSortBy,
  TeacherStudentsSortOrder,
} from '@/features/teacher/types/students';

interface StudentsTableProps {
  students: TeacherStudentRow[];
  sortBy: TeacherStudentsSortBy | undefined;
  sortOrder: TeacherStudentsSortOrder;
  onSortChange: (sortBy: TeacherStudentsSortBy) => void;
  onRowClick: (studentId: string) => void;
}

export function StudentsTable({
  students,
  sortBy,
  sortOrder,
  onSortChange,
  onRowClick,
}: StudentsTableProps) {
  const { t, i18n } = useTranslation('teacher');
  const locale: 'ar' | 'en' = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const percentSign = locale === 'ar' ? '٪' : '%';

  const SortIcon = ({ column }: { column: TeacherStudentsSortBy }) => {
    if (sortBy !== column) return <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
    );
  };

  const SortableTh = ({ column, label }: { column: TeacherStudentsSortBy; label: string }) => (
    <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">
      <button
        type="button"
        onClick={() => onSortChange(column)}
        className="inline-flex cursor-pointer items-center gap-1"
      >
        {label}
        <SortIcon column={column} />
      </button>
    </th>
  );

  const PlainTh = ({ label }: { label: string }) => (
    <th className="px-4 py-3 text-start text-caption font-semibold text-gray-700">{label}</th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-100">
            <SortableTh column="name" label={t('students.table.columns.name')} />
            <PlainTh label={t('students.table.columns.phone')} />
            <PlainTh label={t('students.table.columns.status')} />
            <PlainTh label={t('students.table.columns.chapters')} />
            <PlainTh label={t('students.table.columns.lessons')} />
            <SortableTh column="averageQuizScore" label={t('students.table.columns.avgScore')} />
            <SortableTh column="lastActivity" label={t('students.table.columns.lastActivity')} />
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const percent =
              student.totalLessons > 0
                ? (student.lessonsWatched / student.totalLessons) * 100
                : 0;
            const scoreClasses = getQuizScoreColorClasses(student.averageQuizScore);

            return (
              <tr
                key={student.studentId}
                onClick={() => onRowClick(student.studentId)}
                className="cursor-pointer border-b border-gray-300 transition-colors hover:bg-gray-50"
              >
                {/* Name */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={student.studentName} size="sm" />
                    <span className="text-sm font-semibold text-navy-800">
                      {student.studentName}
                    </span>
                  </div>
                </td>

                {/* Phone */}
                <td className="px-4 py-3.5">
                  <span dir="ltr" className="text-[13px] text-gray-600">
                    {student.studentPhone ?? '—'}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3.5">
                  {student.status === 'active' ? (
                    <Badge variant="success">{t('students.status.active')}</Badge>
                  ) : (
                    <Badge variant="default">{t('students.status.inactive')}</Badge>
                  )}
                </td>

                {/* Chapters */}
                <td className="px-4 py-3.5">
                  <span className="text-sm">
                    {localizeDigits(student.enrolledChapterCount, locale)}
                  </span>
                </td>

                {/* Lessons */}
                <td className="px-4 py-3.5">
                  <div className="text-sm">
                    {localizeDigits(student.lessonsWatched, locale)}/
                    {localizeDigits(student.totalLessons, locale)}
                  </div>
                  <div className="mt-1 h-1 w-full max-w-[80px] overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={getLessonProgressColorClass(
                        student.lessonsWatched,
                        student.totalLessons,
                      )}
                      style={{ width: `${percent}%`, height: '100%' }}
                    />
                  </div>
                </td>

                {/* Avg score */}
                <td className="px-4 py-3.5">
                  {student.averageQuizScore === null ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className={`text-sm font-semibold ${scoreClasses.textClass}`}>
                      {localizeDigits(Math.round(student.averageQuizScore), locale)}
                      {percentSign}
                    </span>
                  )}
                </td>

                {/* Last activity */}
                <td className="px-4 py-3.5">
                  <span className="text-[13px] text-gray-600">
                    {formatRelativeTime(student.lastActivityAt, locale)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
