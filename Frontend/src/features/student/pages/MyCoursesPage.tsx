import { useTranslation } from 'react-i18next';
import { MyCoursesContent } from '@/features/student/components/MyCoursesContent';

/**
 * `/student/courses` (sidebar "Courses"). Renders the student's enrolled courses
 * from the real backend (`GET /content/student/my-courses`) via the shared
 * MyCoursesContent surface — no mock/dummy data, no fallback content.
 */
export function MyCoursesPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('student:myCourses')}</h1>
      <MyCoursesContent enabled />
    </div>
  );
}
