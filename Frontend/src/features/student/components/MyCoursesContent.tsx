import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, AlertCircle, RefreshCw, Compass } from 'lucide-react';
import { Card, Progress, Skeleton } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils/cn';
import {
  useMyCourses,
  useStudentTree,
} from '@/features/student/hooks/useStudentContent';
import { courseContinueDestination } from '@/features/student/lib/myCourses';
import type { MyCourse } from '@/features/student/types/studentContent';

interface MyCoursesContentProps {
  /** Lazily fetch only when the surface (tab/page) is active. */
  enabled?: boolean;
}

/**
 * Real-data "My Courses" surface, shared by the My Courses tab
 * (`/student/content`) and the dedicated courses page (`/student/courses`) so
 * both always render identical backend data and never drift back to mocks.
 *
 * Data source: `useMyCourses()` -> GET /content/student/my-courses.
 * Continue target: resolved from the real content tree (real lesson id).
 */
export function MyCoursesContent({ enabled = true }: MyCoursesContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useMyCourses(enabled);
  // Reuse the existing tree query (shared cache) only to resolve real lesson
  // ids for "Continue"; never used as a data fallback for the course list.
  const { data: tree } = useStudentTree(enabled);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} padding="lg" className="flex flex-col gap-4 border border-gray-200">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-9 w-full rounded-button" />
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card padding="lg" className="border border-gray-200">
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
            <AlertCircle size={32} className="text-danger-500" />
          </span>
          <p className="font-cairo text-sm text-gray-500">{t('student:content.myCoursesTab.error')}</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-1 flex min-h-[44px] items-center justify-center gap-2 rounded-button bg-navy-800 px-6 font-cairo text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:opacity-60"
          >
            <RefreshCw size={16} className={cn(isFetching && 'animate-spin')} />
            {t('student:content.error.retry')}
          </button>
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card padding="lg" className="border border-gray-200">
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-50">
            <GraduationCap size={40} className="text-purple-400" />
          </span>
          <h3 className="font-cairo text-lg font-bold text-navy-900">
            {t('student:content.myCoursesTab.empty.title')}
          </h3>
          <p className="max-w-sm font-cairo text-sm text-gray-500">
            {t('student:content.myCoursesTab.empty.description')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/student/content')}
            className="mt-2 flex min-h-[44px] items-center justify-center gap-2 rounded-button bg-teal-500 px-6 font-cairo text-sm font-semibold text-white transition-colors hover:bg-teal-600"
          >
            <Compass size={16} />
            {t('student:content.myCoursesTab.empty.cta')}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          onOpen={() => navigate(courseContinueDestination(course, tree))}
        />
      ))}
    </div>
  );
}

function CourseCard({ course, onOpen }: { course: MyCourse; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <Card padding="lg" className="flex flex-col gap-3 border border-gray-200">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 font-cairo text-base font-bold text-navy-900">{course.name}</h3>
        {course.price != null && (
          <span className="inline-flex shrink-0 items-center rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 font-cairo text-xs font-medium text-purple-600" dir="ltr">
            {t('student:content.badges.price', { price: course.price })}
          </span>
        )}
      </div>

      <p className="font-cairo text-xs text-gray-400">{course.stageName}</p>

      <div className="flex items-center gap-2 font-cairo text-sm text-gray-500">
        <BookOpen size={16} className="text-gray-400" />
        <span>{t('student:content.myCoursesTab.lessons', { count: course.lessonCount })}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-cairo text-xs text-gray-400">
          {t('student:content.myCoursesTab.progress')}
        </span>
        <Progress value={course.completionProgress} showLabel />
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-1 flex min-h-[40px] items-center justify-center rounded-button border border-gray-300 px-4 font-cairo text-sm font-semibold text-navy-700 transition-colors hover:bg-gray-50"
      >
        {t('student:content.myCoursesTab.continue')}
      </button>
    </Card>
  );
}
