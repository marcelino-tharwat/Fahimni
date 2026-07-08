import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, Users, BookOpen, DollarSign, Wallet, Sparkles, CreditCard,
  ChevronLeft, AlertCircle, GraduationCap,
} from 'lucide-react';
import { Spinner, Badge, EmptyState } from '@/shared/components/ui';
import { Pagination } from '../components/promo-codes';
import { useAdminTeachers } from '@/features/admin/hooks/useAdminTeachers';
import type { AdminTeacher, TeacherStatus } from '@/features/admin/types/teachers';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: (TeacherStatus | 'ALL')[] = ['ALL', 'ACTIVE', 'INACTIVE', 'BANNED'];

const statusVariant: Record<TeacherStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  BANNED: 'danger',
};

export function AdminTeachersPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const nf = (n: number) => n.toLocaleString(locale);
  const money = (n: number) => `${Math.round(n).toLocaleString(locale)} ${t('adminTeachers.currency', 'ج.م')}`;

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<TeacherStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(q ? { q } : {}),
      ...(status !== 'ALL' ? { status } : {}),
    }),
    [page, q, status],
  );

  const { data, isLoading, isError, refetch, isFetching } = useAdminTeachers(query);

  const teachers = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 0;
  const isEmpty = !isLoading && teachers.length === 0;

  const header = (
    <div>
      <h1 className="font-cairo text-2xl font-bold text-text-primary">
        {t('adminTeachers.title', 'المدرسون')}
      </h1>
      <p className="mt-1 font-cairo text-sm text-text-secondary">
        {t('adminTeachers.subtitle', 'إدارة حسابات المدرسين وإحصاءاتهم')}
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      {header}

      {/* Controls: search + status filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute inset-y-0 my-auto text-text-muted ltr:left-3 rtl:right-3"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('adminTeachers.searchPlaceholder', 'ابحث بالاسم أو البريد أو الجوال')}
            aria-label={t('adminTeachers.searchPlaceholder', 'ابحث بالاسم أو البريد أو الجوال')}
            className="h-10 w-full rounded-btn border border-border bg-surface font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label={t('adminTeachers.statusFilter', 'تصفية الحالة')}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setStatus(opt);
                setPage(1);
              }}
              className={`rounded-btn border px-3 py-1.5 font-cairo text-sm font-medium transition-colors ${
                status === opt
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface text-text-secondary hover:bg-gray-100'
              }`}
            >
              {t(`adminTeachers.status.${opt}`, opt)}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-16 text-center shadow-card">
          <AlertCircle size={48} className="text-danger" />
          <p className="font-cairo text-text-secondary">
            {t('adminTeachers.errorLoading', 'تعذّر تحميل قائمة المدرسين')}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100"
          >
            {t('adminTeachers.retry', 'إعادة المحاولة')}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-20" role="status" aria-label={t('common:status.loading', 'جاري التحميل...')}>
              <Spinner />
            </div>
          ) : isEmpty ? (
            <div className="py-12">
              <EmptyState
                icon={GraduationCap}
                title={t('adminTeachers.emptyTitle', 'لا يوجد مدرسون')}
                description={t('adminTeachers.emptyDescription', 'لم يتم العثور على مدرسين مطابقين لبحثك')}
              />
            </div>
          ) : (
            <div className="overflow-x-auto" aria-busy={isFetching}>
              <table className="w-full min-w-[960px] text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-text-secondary">
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeachers.col.teacher', 'المدرس')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeachers.col.students', 'الطلاب')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeachers.col.enrollments', 'الاشتراكات')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeachers.col.courseRevenue', 'إيرادات الكورسات')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeachers.col.subscriptionPayment', 'مدفوعات الباقة')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeachers.col.currentPlan', 'الباقة الحالية')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeachers.col.aiUsage', 'استخدام الذكاء')}</th>
                    <th className="px-4 py-3 text-end font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => (
                    <TeacherRow key={teacher.id} teacher={teacher} nf={nf} money={money} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isEmpty && !isLoading && totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={isFetching}
            />
          )}
        </div>
      )}

      {!isLoading && !isError && total > 0 && (
        <p className="font-cairo text-xs text-text-muted">
          {t('adminTeachers.totalCount', '{{count}} مدرس', { count: total })}
        </p>
      )}
    </div>
  );
}

function TeacherRow({
  teacher,
  nf,
  money,
}: {
  teacher: AdminTeacher;
  nf: (n: number) => string;
  money: (n: number) => string;
}) {
  const { t } = useTranslation();
  const { stats, currentSubscription, pendingSubscriptionPayment } = teacher;

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-gray-50">
      {/* Teacher identity */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10">
            {teacher.profile.photoUrl ? (
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              <img src={teacher.profile.photoUrl} alt={teacher.fullName} className="h-full w-full object-cover" />
            ) : (
              <GraduationCap size={18} className="text-accent" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-cairo font-semibold text-text-primary">{teacher.fullName}</span>
            <span className="font-cairo text-xs text-text-secondary">{teacher.email ?? teacher.mobile}</span>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge variant={statusVariant[teacher.status]}>
                {t(`adminTeachers.status.${teacher.status}`, teacher.status)}
              </Badge>
              {teacher.profile.subject && (
                <Badge variant="cyan">{teacher.profile.subject}</Badge>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Students */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-cairo font-medium text-text-primary">
          <Users size={14} className="text-text-muted" />
          {nf(stats.studentsCount)}
        </span>
      </td>

      {/* Enrollments */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-cairo text-text-primary">
          <BookOpen size={14} className="text-text-muted" />
          {nf(stats.enrollmentsCount)}
        </span>
      </td>

      {/* Course revenue */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-cairo font-medium text-text-primary">
          <DollarSign size={14} className="text-success" />
          {money(stats.confirmedCourseRevenue)}
        </span>
      </td>

      {/* Subscription payment (platform revenue paid by the teacher) */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-cairo text-text-primary">
          <Wallet size={14} className="text-text-muted" />
          {money(stats.confirmedSubscriptionPayments)}
        </span>
      </td>

      {/* Current plan + pending badge */}
      <td className="px-4 py-3">
        {currentSubscription ? (
          <span className="font-cairo text-text-primary">{currentSubscription.plan.displayName}</span>
        ) : (
          <span className="font-cairo text-text-muted">—</span>
        )}
        {pendingSubscriptionPayment && (
          <div className="mt-1">
            <Badge variant="warning">
              <CreditCard size={11} className="me-1" />
              {t('adminTeachers.pendingPayment', 'دفعة معلقة')}
            </Badge>
          </div>
        )}
      </td>

      {/* AI usage */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-cairo text-text-primary">
          <Sparkles size={14} className="text-text-muted" />
          {nf(stats.aiUsage)}
        </span>
      </td>

      {/* View details */}
      <td className="px-4 py-3 text-end">
        <Link
          to={`/admin/teachers/${teacher.id}`}
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline"
        >
          {t('adminTeachers.viewDetails', 'عرض التفاصيل')}
          <ChevronLeft size={14} className="rtl:rotate-180" />
        </Link>
      </td>
    </tr>
  );
}
