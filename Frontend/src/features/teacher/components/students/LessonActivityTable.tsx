import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  formatAbsoluteDateTime,
  getChapterColorClass,
} from '@/features/teacher/lib/studentEngagementPresentation';
import type { TeacherStudentDetailLesson } from '@/features/teacher/types/studentDetail';

interface LessonActivityTableProps {
  lessons: TeacherStudentDetailLesson[];
}

export function LessonActivityTable({ lessons }: LessonActivityTableProps) {
  const { t, i18n } = useTranslation('teacher');
  const locale: 'ar' | 'en' = i18n.language.startsWith('ar') ? 'ar' : 'en';

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
          {lessons.map((lesson) => (
            <tr
              key={lesson.lessonId}
              className="border-b border-gray-300 transition-colors hover:bg-gray-50"
            >
              {/* Lesson name */}
              <td className="px-4 py-3.5">
                <span className="text-sm font-medium text-navy-800">{lesson.lessonTitle}</span>
              </td>

              {/* Chapter + color dot */}
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${getChapterColorClass(
                      lesson.chapterId,
                    )}`}
                  />
                  <span className="text-sm text-gray-700">{lesson.chapterName}</span>
                </div>
              </td>

              {/* Video status */}
              <td className="px-4 py-3.5">
                {lesson.videoWatched ? (
                  <div className="inline-flex items-center gap-1.5 text-sm text-success-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{t('students.detail.video.watched')}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                    <XCircle className="h-4 w-4" />
                    <span>{t('students.detail.video.notWatched')}</span>
                  </div>
                )}
              </td>

              {/* PDF status */}
              <td className="px-4 py-3.5">
                {lesson.pdfDownloaded ? (
                  <div className="inline-flex items-center gap-1.5 text-sm text-success-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{t('students.detail.pdf.downloaded')}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                    <XCircle className="h-4 w-4" />
                    <span>{t('students.detail.pdf.notDownloaded')}</span>
                  </div>
                )}
              </td>

              {/* Last viewed */}
              <td className="px-4 py-3.5">
                {lesson.lastViewedAt === null ? (
                  <span className="text-gray-400">—</span>
                ) : (
                  <span className="text-[13px] text-gray-600">
                    {formatAbsoluteDateTime(lesson.lastViewedAt, locale)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
