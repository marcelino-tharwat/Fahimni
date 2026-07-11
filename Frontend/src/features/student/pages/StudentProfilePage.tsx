import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  Calendar,
  Edit3,
  BookOpen,
  Lock,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { useAppDispatch } from '@/shared/store/hooks';
import { useUpdateStudentProfile } from '@/features/student/hooks/useStudentProfile';
import { useStudentProfileOverview } from '@/features/student/hooks/useStudentProfileOverview';
import type {
  StudentProfileIdentity,
  StudentAcademicProgress,
  StudentCourseSummary,
  StudentSubscriptionSummary,
  StudentAchievement,
} from '@/features/student/types/studentProfile';
import {
  ACHIEVEMENT_META,
  roleLabelKey,
  statusMeta,
  clampPercent,
  formatAverageGrade,
} from '@/features/student/lib/studentProfilePresentation';
import { cn } from '@/shared/lib/utils/cn';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';

function CircularProgress({ percent, size = 40 }: { percent: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = clampPercent(percent);
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      style={{ direction: 'ltr' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#00C9DB"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-navy-900 text-caption font-bold"
      >
        {value}%
      </text>
    </svg>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const value = clampPercent(percent);
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-gray-300"
    >
      <div
        className="h-full rounded-full bg-cyan-500 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: 'active' | 'ended' }) {
  const { t } = useTranslation('student');
  return status === 'active' ? (
    <span className="rounded-badge bg-success-50 px-3 py-0.5 text-small text-success-600">
      {t('profile.active')}
    </span>
  ) : (
    <span className="rounded-badge bg-gray-200 px-3 py-0.5 text-small text-gray-600">
      {t('profile.ended')}
    </span>
  );
}

function AcademicProgressCard({ progress }: { progress: StudentAcademicProgress }) {
  const { t } = useTranslation('student');
  const avg = formatAverageGrade(progress.averageGrade);

  return (
    <div className="rounded-card bg-white p-4 shadow-card md:p-5">
      <h2 className="mb-4 font-cairo text-h3 font-bold text-navy-900">
        {t('profile.academicProgress')}
      </h2>

      <div className="mb-4 flex gap-4">
        <div className="flex-1 rounded-md bg-gray-100 p-3 text-center">
          <p className="font-cairo text-h2 font-bold text-cyan-600">
            {progress.averageGrade === null ? avg : `%${avg}`}
          </p>
          <p className="font-cairo text-caption text-gray-600">{t('profile.avgScore')}</p>
        </div>
        <div className="flex-1 rounded-md bg-gray-100 p-3 text-center">
          <p className="font-cairo text-h2 font-bold text-cyan-600">{progress.completedQuizzes}</p>
          <p className="font-cairo text-caption text-gray-600">{t('profile.quizzesDone')}</p>
        </div>
        <div className="flex-1 rounded-md bg-gray-100 p-3 text-center">
          <p className="font-cairo text-h2 font-bold text-cyan-600">{progress.completedLessons}</p>
          <p className="font-cairo text-caption text-gray-600">{t('profile.lessonsDone')}</p>
        </div>
      </div>

      <h3 className="mb-2 font-cairo text-body font-semibold text-navy-900">
        {t('profile.overallProgress')}
      </h3>
      <p className="mb-1 font-cairo text-h3 font-bold text-cyan-600">
        %{clampPercent(progress.overallProgressPercent)}
      </p>
      <ProgressBar percent={progress.overallProgressPercent} />
      <p className="mt-1 font-cairo text-caption text-gray-600">
        {t('profile.lessonsOf', {
          done: progress.completedLessons,
          total: progress.totalLessons,
        })}
      </p>
    </div>
  );
}

function MyCoursesCard({ courses }: { courses: StudentCourseSummary[] }) {
  const { t } = useTranslation('student');
  const navigate = useNavigate();

  if (courses.length === 0) {
    return (
      <div className="rounded-card bg-white p-4 shadow-card md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-cairo text-h3 font-bold text-navy-900">{t('profile.myCourses')}</h2>
        </div>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <BookOpen size={32} className="text-gray-400" />
          <p className="font-cairo text-body text-gray-600">{t('profile.noEnrollments')}</p>
          <p className="font-cairo text-caption text-gray-500">{t('profile.noEnrollmentsDesc')}</p>
        </div>
      </div>
    );
  }

  // Compact preview — first 3, full list lives on /student/courses.
  const preview = courses.slice(0, 3);

  return (
    <div className="rounded-card bg-white p-4 shadow-card md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-cairo text-h3 font-bold text-navy-900">{t('profile.myCourses')}</h2>
        <button
          type="button"
          onClick={() => navigate('/student/courses')}
          className="text-small text-cyan-600 underline underline-offset-2"
        >
          {t('profile.viewAll')}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {preview.map((course) => (
          <div key={course.id} className="flex gap-3 rounded-md border-r-4 border-cyan-500 p-3">
            <div className="flex shrink-0 items-start pt-1">
              <CircularProgress percent={course.progressPercent} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-cairo text-body font-semibold text-navy-900">
                  {course.title}
                </p>
                <span className="shrink-0 rounded-badge bg-success-50 px-2.5 py-0.5 text-caption text-success-600">
                  {t('content.badges.subscribed')}
                </span>
              </div>
              {course.subtitle && (
                <p className="truncate font-cairo text-caption text-gray-600">{course.subtitle}</p>
              )}
              <div className="mt-1.5">
                <ProgressBar percent={course.progressPercent} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentMethodBadge({ method }: { method: string }) {
  const { t } = useTranslation('student');
  // FREE → "مجاناً" (green); PROMO → "كود خصم" (purple); PAYMOB/other → "بايموب" (cyan).
  if (method === 'FREE') {
    return (
      <span className="rounded-badge bg-success-50 px-2.5 py-0.5 text-caption text-success-600">
        {t('profile.paymentMethod.FREE')}
      </span>
    );
  }
  if (method === 'PROMO') {
    return (
      <span className="rounded-badge bg-purple-50 px-2.5 py-0.5 text-caption text-purple-600">
        {t('profile.paymentMethod.PROMO')}
      </span>
    );
  }
  return (
    <span className="rounded-badge bg-cyan-50 px-2.5 py-0.5 text-caption text-cyan-700">
      {t('profile.paymentMethod.PAYMOB')}
    </span>
  );
}

function SubscriptionHistoryCard({
  subscriptions,
}: {
  subscriptions: StudentSubscriptionSummary[];
}) {
  const { t, i18n } = useTranslation('student');
  const navigate = useNavigate();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en';

  // Compact preview — first 3; full list lives on /student/courses.
  const preview = subscriptions.slice(0, 3);

  return (
    <div className="rounded-card bg-white p-4 shadow-card md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-cairo text-h3 font-bold text-navy-900">
          {t('profile.subscriptionHistory')}
        </h2>
        <button
          type="button"
          onClick={() => navigate('/student/courses')}
          className="text-small text-cyan-600 underline underline-offset-2"
        >
          {t('profile.viewAll')}
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <BookOpen size={32} className="text-gray-400" />
          <p className="font-cairo text-body text-gray-600">{t('profile.noEnrollments')}</p>
          <p className="font-cairo text-caption text-gray-500">{t('profile.noEnrollmentsDesc')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {preview.map((sub) => {
            const dateLabel = new Date(sub.startedAt).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
            const isFree = sub.price <= 0;
            const priceLabel = isFree
              ? t('payment.promo.free')
              : t('content.badges.price', { price: sub.price.toLocaleString(locale) });
            return (
              <div key={sub.id} className="flex items-center justify-between gap-2">
                <div className="flex flex-col items-start gap-1.5">
                  <StatusBadge status={sub.status === 'ACTIVE' ? 'active' : 'ended'} />
                  <div className="flex items-center gap-1.5">
                    <PaymentMethodBadge method={sub.planType} />
                    <span
                      className={cn(
                        'font-cairo text-caption font-semibold',
                        isFree ? 'text-success-600' : 'text-gray-700',
                      )}
                      dir="ltr"
                    >
                      {priceLabel}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 text-end">
                  <p className="truncate font-cairo text-body text-navy-900">{sub.title}</p>
                  <div className="flex items-center justify-end gap-1 font-cairo text-caption text-gray-600">
                    <Calendar size={12} />
                    <span>{dateLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileInfoCard({ student }: { student: StudentProfileIdentity }) {
  const { t, i18n } = useTranslation('student');
  const dispatch = useAppDispatch();
  const updateProfile = useUpdateStudentProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const initial = student.avatarInitial || '?';
  const status = statusMeta(student.status);

  // The display always reads from `student` (the live query data); the form is
  // seeded from it only when the user opens the editor, so no effect-driven
  // sync is needed.
  const handleStartEdit = () => {
    setForm({
      name: student.fullName ?? '',
      email: student.email ?? '',
      phone: student.phone ?? '',
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateProfile.mutate(
      {
        fullName: form.name.trim(),
        email: form.email.trim().toLowerCase(),
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          dispatch(addToast({ type: 'success', message: t('profile.saved') }));
        },
        onError: (error) => {
          dispatch(addToast({ type: 'error', message: translateApiError(t, error) }));
        },
      },
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="rounded-card bg-white p-4 shadow-card md:p-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-700">
              <span className="font-cairo text-h2 text-white">{initial}</span>
            </div>
            <span className="absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-white bg-success-500" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={t('profile.fullName')}
            className="w-full rounded-input border border-gray-300 px-3 py-2 font-cairo text-body outline-none focus:border-cyan-500"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder={t('profile.email')}
            className="w-full rounded-input border border-gray-300 px-3 py-2 font-cairo text-body outline-none focus:border-cyan-500"
            dir="ltr"
          />
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder={t('profile.phone')}
            className="w-full rounded-input border border-gray-300 px-3 py-2 font-cairo text-body outline-none focus:border-cyan-500"
            dir="ltr"
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateProfile.isPending}
            className="flex-1 rounded-btn bg-cyan-500 px-4 py-2 font-cairo font-bold text-navy-900 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {t('common:actions.save')}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 rounded-btn border border-gray-300 px-4 py-2 font-cairo text-gray-600 transition-colors hover:bg-gray-50"
          >
            {t('common:actions.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-white p-4 shadow-card md:p-6">
      <div className="flex flex-col items-center">
        <div className="relative mb-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-700">
            <span className="font-cairo text-h2 text-white">{initial}</span>
          </div>
          <span
            className={cn(
              'absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-white',
              status.active ? 'bg-success-500' : 'bg-gray-400',
            )}
          />
        </div>

        <h3 className="font-cairo text-h3 font-bold text-navy-900">{student.fullName}</h3>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-badge bg-navy-100 px-3 py-0.5 text-small text-navy-700">
            {t(`profile.${roleLabelKey(student.role)}`)}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-badge px-3 py-0.5 text-small',
              status.active ? 'bg-success-50 text-success-600' : 'bg-gray-200 text-gray-600',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status.active ? 'bg-success-500' : 'bg-gray-400',
              )}
            />
            {t(`profile.${status.labelKey}`)}
          </span>
        </div>
      </div>

      <div className="my-4 border-t border-gray-300" />

      <div className="flex flex-col gap-3">
        {student.stageName && (
          <div className="flex items-center justify-between gap-2 text-end">
            <span className="font-cairo text-body font-medium text-navy-900">
              {student.stageName}
            </span>
            <GraduationCap size={16} className="shrink-0 text-gray-500" />
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-end">
          <span className="font-cairo text-body text-gray-700" dir="ltr">
            {student.email ?? '—'}
          </span>
          <Mail size={16} className="shrink-0 text-gray-500" />
        </div>
        <div className="flex items-center justify-between gap-2 text-end">
          <span className="font-cairo text-body text-gray-700" dir="ltr">
            {student.phone ?? '—'}
          </span>
          <Phone size={16} className="shrink-0 text-gray-500" />
        </div>
        <div className="flex items-center justify-between gap-2 text-end">
          <span className="font-cairo text-body text-gray-700">
            {student.joinedAt
              ? t('profile.joinedAt', {
                  date: new Date(student.joinedAt).toLocaleDateString(
                    i18n.language === 'ar' ? 'ar-EG' : 'en',
                    { year: 'numeric', month: 'long' },
                  ),
                })
              : '—'}
          </span>
          <Calendar size={16} className="shrink-0 text-gray-500" />
        </div>
      </div>

      <button
        type="button"
        onClick={handleStartEdit}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-btn border border-gray-300 py-2 font-cairo text-body text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Edit3 size={16} />
        <span>{t('profile.editProfile')}</span>
      </button>
    </div>
  );
}

function AchievementsCard({ achievements }: { achievements: StudentAchievement[] }) {
  const { t } = useTranslation('student');

  return (
    <div className="rounded-card bg-white p-4 shadow-card md:p-5">
      <h2 className="mb-4 font-cairo text-h3 font-bold text-navy-900">
        {t('profile.achievements')}
      </h2>

      <div className="flex flex-wrap items-center justify-center gap-6">
        {achievements.map((badge) => {
          const meta = ACHIEVEMENT_META[badge.id];
          if (!meta) return null;
          const locked = !badge.unlocked;
          return (
            <div key={badge.id} className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'relative flex h-[52px] w-[52px] items-center justify-center rounded-full',
                  meta.color,
                )}
              >
                <span className="text-lg">{meta.emoji}</span>
                {locked && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <Lock size={16} className="text-white" />
                  </div>
                )}
              </div>
              <span className="font-cairo text-caption text-gray-600">
                {t(`profile.${meta.nameKey}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePageSkeleton() {
  return (
    <div className="mx-auto w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-card bg-white p-4 shadow-card md:p-6">
          <div className="flex flex-col items-center">
            <div className="mb-3 h-20 w-20 animate-pulse rounded-full bg-gray-200" />
            <div className="mb-3 h-5 w-32 animate-pulse rounded bg-gray-200" />
            <div className="flex gap-2">
              <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
            </div>
          </div>
          <div className="my-4 border-t border-gray-300" />
          <div className="flex flex-col gap-3">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-card bg-white p-4 shadow-card md:p-5">
              <div className="mb-4 h-6 w-40 animate-pulse rounded bg-gray-200" />
              <div className="flex flex-col gap-3">
                <div className="h-14 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-14 w-full animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StudentProfilePage() {
  const { t } = useTranslation('student');
  const { data, isLoading, isError, refetch, isFetching } = useStudentProfileOverview();

  if (isLoading) {
    return <ProfilePageSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto w-full">
        <div className="rounded-card bg-white p-8 shadow-card">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle size={40} className="text-danger-500" />
            <p className="font-cairo text-body text-navy-900">{t('profile.loadError')}</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-btn bg-cyan-500 px-6 py-2 font-cairo font-bold text-navy-900 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {t('profile.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ProfileInfoCard student={data.student} />

        <div className="flex flex-col gap-6">
          <AcademicProgressCard progress={data.academicProgress} />
          <MyCoursesCard courses={data.courses} />
          <SubscriptionHistoryCard subscriptions={data.subscriptions} />
        </div>
      </div>

      <div className="mt-6">
        <AchievementsCard achievements={data.achievements} />
      </div>
    </div>
  );
}
