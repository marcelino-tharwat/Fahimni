import { useTranslation } from 'react-i18next';
import { Avatar } from '@/shared/components/ui';
import { useAppSelector } from '@/shared/store/hooks';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { useMyCourses } from '@/features/student/hooks/useStudentContent';
import { overallProgress } from '@/features/student/lib/studentStats';

/**
 * Welcome / stats strip at the top of the student dashboard.
 *
 * Strictly real data: the greeting name comes from the auth session and the
 * overall-progress percentage is derived from the student's enrolled courses
 * (`GET /content/student/my-courses`). The mockup's streak / points / rank /
 * "incomplete today" have no backing data in this product, so they are
 * intentionally omitted rather than faked.
 */
export function StudentHero() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  // Shares the React Query cache with the My Courses tab — no extra request.
  const { data: courses } = useMyCourses();

  const name = user?.fullName ?? '';
  const enrolledCount = courses?.length ?? 0;
  const hasCourses = enrolledCount > 0;
  const progress = overallProgress(courses);

  return (
    <section className="overflow-hidden rounded-card bg-hero-gradient p-5 text-white shadow-card sm:p-6">
      <div className="flex items-center gap-4">
        <Avatar name={name} size="lg" className="shrink-0 ring-2 ring-white/20" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-cairo text-xl font-bold sm:text-2xl">
            {t('student:hero.greeting', { name })}
          </h1>
          <p className="mt-1 font-cairo text-sm text-white/70">
            {hasCourses
              ? t('student:hero.subtitleActive', { n: toLocalNum(enrolledCount) })
              : t('student:hero.subtitleEmpty')}
          </p>
        </div>
      </div>

      {hasCourses && (
        <div className="mt-5 flex flex-col gap-2">
          <div className="flex items-center justify-between font-cairo text-sm">
            <span className="text-white/80">{t('student:hero.overallProgress')}</span>
            <span className="font-semibold text-cyan-300">{toLocalNum(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-cyan-gradient transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
