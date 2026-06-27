import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  Phone,
  Calendar,
  Edit3,
  BookOpen,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/shared/store/hooks';
import {
  useStudentProfile,
  useStudentEnrollments,
  useUpdateStudentProfile,
} from '@/features/student/hooks/useStudentProfile';
import { Skeleton } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils/cn';
import { addToast } from '@/shared/store/slices/toastSlice';

// TODO: replace with real endpoint when available
const ACADEMIC_STATS = {
  avgScore: 78,
  quizzesDone: 3,
  lessonsDone: 12,
  overallProgress: 45,
  overallDone: 21,
  overallTotal: 48,
} as const;

// TODO: replace with real achievements endpoint when available
const ACHIEVEMENTS = [
  { nameKey: 'firstLesson', emoji: '📖', color: 'bg-warning-500', locked: false },
  { nameKey: 'tenLessons', emoji: '📚', color: 'bg-cyan-500', locked: false },
  { nameKey: 'firstQuiz', emoji: '✍️', color: 'bg-purple-500', locked: false },
  { nameKey: 'twentyFiveLessons', emoji: '📚', color: 'bg-gray-400', locked: true },
  { nameKey: 'perfectScore', emoji: '🏆', color: 'bg-gray-400', locked: true },
] as const;

function CircularProgress({ percent, size = 40 }: { percent: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

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
        {percent}%
      </text>
    </svg>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-gray-300"
    >
      <div
        className="h-full rounded-full bg-cyan-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
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

function AcademicProgressCard() {
  const { t } = useTranslation('student');

  return (
    <div className="rounded-card bg-white p-4 shadow-card md:p-5">
      <h2 className="mb-4 font-cairo text-h3 font-bold text-navy-900">
        {t('profile.academicProgress')}
      </h2>

      <div className="mb-4 flex gap-4">
        <div className="flex-1 rounded-md bg-gray-100 p-3 text-center">
          <p className="font-cairo text-h2 font-bold text-cyan-600">%{ACADEMIC_STATS.avgScore}</p>
          <p className="font-cairo text-caption text-gray-600">{t('profile.avgScore')}</p>
        </div>
        <div className="flex-1 rounded-md bg-gray-100 p-3 text-center">
          <p className="font-cairo text-h2 font-bold text-cyan-600">{ACADEMIC_STATS.quizzesDone}</p>
          <p className="font-cairo text-caption text-gray-600">{t('profile.quizzesDone')}</p>
        </div>
        <div className="flex-1 rounded-md bg-gray-100 p-3 text-center">
          <p className="font-cairo text-h2 font-bold text-cyan-600">{ACADEMIC_STATS.lessonsDone}</p>
          <p className="font-cairo text-caption text-gray-600">{t('profile.lessonsDone')}</p>
        </div>
      </div>

      <h3 className="mb-2 font-cairo text-body font-semibold text-navy-900">
        {t('profile.overallProgress')}
      </h3>
      <p className="mb-1 font-cairo text-h3 font-bold text-cyan-600">
        %{ACADEMIC_STATS.overallProgress}
      </p>
      <ProgressBar percent={ACADEMIC_STATS.overallProgress} />
      <p className="mt-1 font-cairo text-caption text-gray-600">
        {t('profile.lessonsOf', { done: ACADEMIC_STATS.overallDone, total: ACADEMIC_STATS.overallTotal })}
      </p>
    </div>
  );
}

function MyCoursesCard() {
  const { t, i18n } = useTranslation('student');
  const { data: enrollments, isLoading, isError } = useStudentEnrollments();

  if (isLoading) {
    return (
      <div className="rounded-card bg-white p-4 shadow-card md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 rounded-md p-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
                <div className="h-2 w-full animate-pulse rounded-full bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-card bg-white p-4 shadow-card md:p-5">
        <h2 className="mb-4 font-cairo text-h3 font-bold text-navy-900">
          {t('profile.myCourses')}
        </h2>
        <div className="flex items-center gap-2 font-cairo text-body text-danger-500">
          <AlertCircle size={16} />
          <span>{t('profile.enrollmentLoadError')}</span>
        </div>
      </div>
    );
  }

  const items = (enrollments ?? []).map((enr) => {
    const e = enr as Record<string, unknown>;
    return {
      name: enr.chapterName,
      percent: Number(e.progress ?? 0),
      completed: Number(e.lessonsCompleted ?? 0),
      total: Number(e.totalLessons ?? 0),
    };
  });

  if (items.length === 0) {
    return (
      <div className="rounded-card bg-white p-4 shadow-card md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div />
          <h2 className="font-cairo text-h3 font-bold text-navy-900">
            {t('profile.myCourses')}
          </h2>
        </div>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <BookOpen size={32} className="text-gray-400" />
          <p className="font-cairo text-body text-gray-600">{t('profile.noEnrollments')}</p>
          <p className="font-cairo text-caption text-gray-500">{t('profile.noEnrollmentsDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-white p-4 shadow-card md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" className="text-small text-cyan-600 underline underline-offset-2">
          {t('profile.viewAll')}
        </button>
        <h2 className="font-cairo text-h3 font-bold text-navy-900">
          {t('profile.myCourses')}
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((course) => (
          <div key={course.name} className="flex gap-3 rounded-md border-r-4 border-cyan-500 p-3">
            <div className="flex shrink-0 items-start pt-1">
              <CircularProgress percent={course.percent} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate font-cairo text-body font-semibold text-navy-900">
                {course.name}
              </p>
              <p className="font-cairo text-caption text-gray-600">
                {t('profile.chaptersCompleted', { done: course.completed, total: course.total })}
              </p>
              <div className="mt-1.5">
                <ProgressBar percent={course.percent} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubscriptionHistoryCard() {
  const { t, i18n } = useTranslation('student');
  const { data: enrollments, isLoading, isError } = useStudentEnrollments();

  if (isLoading) {
    return (
      <div className="rounded-card bg-white p-4 shadow-card md:p-5">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-card bg-white p-4 shadow-card md:p-5">
        <h2 className="mb-4 font-cairo text-h3 font-bold text-navy-900">
          {t('profile.subscriptionHistory')}
        </h2>
        <div className="flex items-center gap-2 font-cairo text-body text-danger-500">
          <AlertCircle size={16} />
          <span>{t('profile.enrollmentLoadError')}</span>
        </div>
      </div>
    );
  }

  const items = (enrollments ?? []).length > 0
    ? (enrollments ?? []).map((enr) => {
        const monthNames = i18n.language === 'ar'
          ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
          : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return {
          courseName: enr.chapterName,
          date: `${monthNames[parseInt(enr.month) - 1] || enr.month} ${enr.year}`,
          status: enr.status === 'Active' ? 'active' as const : 'ended' as const,
        };
      })
    : [];

  return (
    <div className="rounded-card bg-white p-4 shadow-card md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" className="text-small text-cyan-600 underline underline-offset-2">
          {t('profile.viewAll')}
        </button>
        <h2 className="font-cairo text-h3 font-bold text-navy-900">
          {t('profile.subscriptionHistory')}
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <BookOpen size={32} className="text-gray-400" />
          <p className="font-cairo text-body text-gray-600">{t('profile.noEnrollments')}</p>
          <p className="font-cairo text-caption text-gray-500">{t('profile.noEnrollmentsDesc')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((sub) => (
            <div key={`${sub.courseName}-${sub.date}`} className="flex items-center justify-between gap-2">
              <StatusBadge status={sub.status} />
              <div className="text-end">
                <p className="font-cairo text-body text-navy-900">{sub.courseName}</p>
                <div className="flex items-center justify-end gap-1 font-cairo text-caption text-gray-600">
                  <Calendar size={12} />
                  <span>{sub.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileInfoCard({ isLoading }: { isLoading: boolean }) {
  const { t, i18n } = useTranslation('student');
  const dispatch = useAppDispatch();
  const updateProfile = useUpdateStudentProfile();
  const studentUser = useAppSelector((state) => state.student.profile?.user);
  const authUser = useAppSelector((state) => state.auth.user);
  const profileUser = studentUser ?? authUser;

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (!isEditing) {
      setForm({
        name: profileUser?.fullName ?? '',
        email: profileUser?.email ?? '',
        phone: profileUser?.mobile ?? '',
      });
    }
  }, [profileUser, isEditing]);

  if (isLoading) {
    return (
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
    );
  }

  const displayName = profileUser?.fullName ?? '';
  const displayEmail = profileUser?.email ?? '';
  const displayPhone = profileUser?.mobile ?? '';
  const createdAt = profileUser?.createdAt ?? '';
  const initial = displayName.trim().charAt(0) || '?';

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
          const err = error as { message?: string };
          dispatch(addToast({ type: 'error', message: err.message || t('profile.saveError') }));
        },
      },
    );
  };

  const handleCancel = () => {
    setForm({
      name: profileUser?.fullName ?? '',
      email: profileUser?.email ?? '',
      phone: profileUser?.mobile ?? '',
    });
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
          <span className="absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-white bg-success-500" />
        </div>

        <h3 className="font-cairo text-h3 font-bold text-navy-900">{displayName}</h3>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-badge bg-navy-100 px-3 py-0.5 text-small text-navy-700">
            {t('profile.student')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-badge bg-success-50 px-3 py-0.5 text-small text-success-600">
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
            {t('profile.active')}
          </span>
        </div>
      </div>

      <div className="my-4 border-t border-gray-300" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 text-end">
          <span className="font-cairo text-body text-gray-700" dir="ltr">{displayEmail}</span>
          <Mail size={16} className="shrink-0 text-gray-500" />
        </div>
        <div className="flex items-center justify-between gap-2 text-end">
          <span className="font-cairo text-body text-gray-700" dir="ltr">{displayPhone}</span>
          <Phone size={16} className="shrink-0 text-gray-500" />
        </div>
        <div className="flex items-center justify-between gap-2 text-end">
          <span className="font-cairo text-body text-gray-700">
            {createdAt
              ? t('profile.joinedAt', {
                  date: new Date(createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en', {
                    year: 'numeric',
                    month: 'long',
                  }),
                })
              : '—'}
          </span>
          <Calendar size={16} className="shrink-0 text-gray-500" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-btn border border-gray-300 py-2 font-cairo text-body text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Edit3 size={16} />
        <span>{t('profile.editProfile')}</span>
      </button>
    </div>
  );
}

function AchievementsCard() {
  const { t } = useTranslation('student');

  return (
    <div className="rounded-card bg-white p-4 shadow-card md:p-5">
      <h2 className="mb-4 font-cairo text-h3 font-bold text-navy-900">
        {t('profile.achievements')}
      </h2>

      <div className="flex items-center justify-center gap-6">
        {ACHIEVEMENTS.map((badge) => (
          <div key={badge.nameKey} className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'relative flex h-[52px] w-[52px] items-center justify-center rounded-full',
                badge.color,
              )}
            >
              <span className="text-lg">{badge.emoji}</span>
              {badge.locked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Lock size={16} className="text-white" />
                </div>
              )}
            </div>
            <span className="font-cairo text-caption text-gray-600">
              {t(`profile.${badge.nameKey}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentProfilePage() {
  const { isLoading } = useStudentProfile();

  return (
    <div className="mx-auto w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ProfileInfoCard isLoading={isLoading} />

        <div className="flex flex-col gap-6">
          <AcademicProgressCard />
          <MyCoursesCard />
          <SubscriptionHistoryCard />
        </div>
      </div>

      <div className="mt-6">
        <AchievementsCard />
      </div>
    </div>
  );
}
