import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/shared/hooks/useDirection';
import {
  Search, Users, GraduationCap, BookOpen, CreditCard, AlertCircle, X, Sparkles,
  UserCheck, Clock, DollarSign, ChevronLeft,
} from 'lucide-react';
import { Spinner, Badge, EmptyState, StatCard } from '@/shared/components/ui';
import { Pagination } from '../components/promo-codes';
import {
  useAdminStudents, useAdminStudentDetail, useAdminStudentEnrollments,
  useAdminStudentPayments, useAdminStudentLearning,
} from '@/features/admin/hooks/useAdminStudents';
import type {
  AdminStudentListItem, StudentFilter, StudentStatus,
} from '@/features/admin/types/students';

const PAGE_SIZE = 20;
const FILTERS: StudentFilter[] = ['all', 'active', 'without_enrollment', 'without_active_teacher', 'payment_pending'];
const isFilter = (v: string | null): v is StudentFilter =>
  !!v && (FILTERS as string[]).includes(v);

const statusVariant: Record<StudentStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  BANNED: 'danger',
};

export function AdminStudentsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const nf = (n: number) => n.toLocaleString(locale);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get('filter');
  const filter: StudentFilter = isFilter(urlFilter) ? urlFilter : 'all';

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Reset page when the filter (tab) changes.
  useEffect(() => { setPage(1); }, [filter]);

  const query = useMemo(
    () => ({ page, limit: PAGE_SIZE, filter, ...(q ? { q } : {}) }),
    [page, filter, q],
  );
  const { data, isLoading, isError, refetch, isFetching } = useAdminStudents(query);

  const students = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 0;
  const isEmpty = !isLoading && students.length === 0;

  const setFilter = (next: StudentFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('filter');
    else params.set('filter', next);
    setSearchParams(params);
  };

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('adminStudents.title', 'الطلاب')}</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">{t('adminStudents.subtitle', 'إدارة حسابات الطلاب واشتراكاتهم')}</p>
      </div>

      {/* Tabs (URL-driven) */}
      <div className="overflow-x-auto" role="tablist" aria-label={t('adminStudents.title', 'الطلاب')}>
        <div className="flex gap-2 border-b border-border">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 font-cairo text-sm font-medium transition-colors ${
                filter === f ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {t(`adminStudents.tabs.${f}`, f)}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-xs">
        <Search size={16} className="pointer-events-none absolute inset-y-0 my-auto text-text-muted ltr:left-3 rtl:right-3" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('adminStudents.searchPlaceholder', 'ابحث بالاسم أو البريد أو الجوال')}
          aria-label={t('adminStudents.searchPlaceholder', 'ابحث بالاسم أو البريد أو الجوال')}
          className="h-10 w-full rounded-btn border border-border bg-surface font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
        />
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-16 text-center shadow-card">
          <AlertCircle size={48} className="text-danger" />
          <p className="font-cairo text-text-secondary">{t('adminStudents.errorLoading', 'تعذّر تحميل قائمة الطلاب')}</p>
          <button type="button" onClick={() => refetch()} className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100">
            {t('adminStudents.retry', 'إعادة المحاولة')}
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
              <EmptyState icon={Users} title={t('adminStudents.emptyTitle', 'لا يوجد طلاب')} description={t('adminStudents.emptyDescription', 'لا يوجد طلاب مطابقون لهذا التصنيف')} />
            </div>
          ) : (
            <div className="overflow-x-auto" aria-busy={isFetching}>
              <table className="w-full min-w-[900px] text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-text-secondary">
                    <th className="px-4 py-3 text-start font-medium">{t('adminStudents.col.student', 'الطالب')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminStudents.col.teachers', 'المدرسون')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminStudents.col.activeEnrollments', 'اشتراكات نشطة')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminStudents.col.pending', 'معلّق')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminStudents.col.createdAt', 'تاريخ الإنشاء')}</th>
                    <th className="px-4 py-3 text-end font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <StudentRow key={s.id} student={s} nf={nf} onView={() => setSelectedId(s.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isEmpty && !isLoading && totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} isLoading={isFetching} />
          )}
        </div>
      )}

      {!isLoading && !isError && total > 0 && (
        <p className="font-cairo text-xs text-text-muted">{t('adminStudents.totalCount', '{{count}} طالب', { count: total })}</p>
      )}

      {selectedId && <StudentDetailDrawer studentId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function StudentRow({
  student, nf, onView,
}: {
  student: AdminStudentListItem;
  nf: (n: number) => string;
  onView: () => void;
}) {
  const { t, i18n } = useTranslation();
  const created = new Date(student.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-cairo font-semibold text-text-primary">{student.fullName}</span>
          <span className="font-cairo text-xs text-text-secondary">{student.email ?? student.mobile}</span>
          <div className="mt-0.5"><Badge variant={statusVariant[student.status]}>{t(`adminStudents.status.${student.status}`, student.status)}</Badge></div>
        </div>
      </td>
      <td className="px-4 py-3">
        {student.teachersCount === 0 ? (
          <span className="font-cairo text-text-muted">—</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="font-cairo text-xs text-text-secondary">{t('adminStudents.teachersCount', '{{count}} مدرس', { count: student.teachersCount })}</span>
            <div className="flex flex-wrap gap-1">
              {student.teachers.slice(0, 3).map((tch) => (
                <Badge key={tch.id} variant="cyan">{tch.fullName}</Badge>
              ))}
              {student.teachers.length > 3 && (
                <Badge variant="default">+{nf(student.teachers.length - 3)}</Badge>
              )}
            </div>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-cairo font-medium text-text-primary">
          <UserCheck size={14} className="text-text-muted" />{nf(student.activeEnrollmentsCount)}
        </span>
      </td>
      <td className="px-4 py-3">
        {student.pendingEnrollmentsCount + student.pendingPaymentsCount > 0 ? (
          <Badge variant="warning">
            <CreditCard size={11} className="me-1" />
            {nf(student.pendingEnrollmentsCount + student.pendingPaymentsCount)}
          </Badge>
        ) : (
          <span className="font-cairo text-text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3 font-cairo text-text-secondary">{created}</td>
      <td className="px-4 py-3 text-end">
        <button type="button" onClick={onView} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline">
          {t('adminStudents.viewDetails', 'عرض التفاصيل')}
          <ChevronLeft size={14} className="rtl:rotate-180" />
        </button>
      </td>
    </tr>
  );
}

function StudentDetailDrawer({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const dir = useDirection();
  const nf = (n: number) => n.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
  const detail = useAdminStudentDetail(studentId);
  const enrollments = useAdminStudentEnrollments(studentId);
  const payments = useAdminStudentPayments(studentId);
  const learning = useAdminStudentLearning(studentId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full max-w-lg flex-col gap-4 overflow-y-auto bg-background p-5 shadow-elevated" dir={dir}>
        <div className="flex items-center justify-between">
          <h2 className="font-cairo text-lg font-bold text-text-primary">{t('adminStudents.detail.title', 'تفاصيل الطالب')}</h2>
          <button type="button" onClick={onClose} aria-label={t('adminStudents.detail.close', 'إغلاق')} className="rounded-btn p-1.5 text-text-muted hover:bg-gray-100 hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {detail.isLoading ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label={t('common:status.loading', 'جاري التحميل...')}><Spinner /></div>
        ) : detail.isError || !detail.data ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle size={40} className="text-danger" />
            <p className="font-cairo text-text-secondary">{t('adminStudents.detail.error', 'تعذّر تحميل بيانات الطالب')}</p>
            <button type="button" onClick={() => detail.refetch()} className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary hover:bg-gray-100">
              {t('adminStudents.retry', 'إعادة المحاولة')}
            </button>
          </div>
        ) : (
          <>
            {/* Identity */}
            <div className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className="font-cairo text-base font-bold text-text-primary">{detail.data.student.fullName}</span>
                <Badge variant={statusVariant[detail.data.student.status]}>{t(`adminStudents.status.${detail.data.student.status}`, detail.data.student.status)}</Badge>
              </div>
              <p className="mt-1 font-cairo text-sm text-text-secondary">{detail.data.student.email ?? '—'} · {detail.data.student.mobile}</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={BookOpen} title={t('adminStudents.detail.enrollments', 'الاشتراكات')} value={nf(detail.data.summary.enrollmentsCount)} />
              <StatCard icon={UserCheck} title={t('adminStudents.detail.active', 'نشطة')} value={nf(detail.data.summary.activeEnrollmentsCount)} />
              <StatCard icon={GraduationCap} title={t('adminStudents.detail.teachers', 'المدرسون')} value={nf(detail.data.summary.teachersCount)} />
              <StatCard icon={Sparkles} title={t('adminStudents.detail.quizAttempts', 'محاولات الاختبار')} value={nf(detail.data.summary.quizAttemptsCount)} />
              <StatCard icon={Clock} title={t('adminStudents.detail.avgScore', 'متوسط الدرجات')} value={`${nf(detail.data.summary.averageScore)}%`} />
              <StatCard icon={DollarSign} title={t('adminStudents.detail.confirmedPayments', 'مدفوعات مؤكدة')} value={nf(detail.data.summary.confirmedPayments)} />
            </div>

            {/* Teachers */}
            <Section title={t('adminStudents.detail.teachersList', 'المدرسون')}>
              {detail.data.teachers.length === 0 ? (
                <Muted>{t('adminStudents.detail.noTeachers', 'لا يوجد مدرسون')}</Muted>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.data.teachers.map((tch) => (
                    <Badge key={tch.id} variant="cyan">{tch.fullName}{tch.subject ? ` · ${tch.subject}` : ''}</Badge>
                  ))}
                </div>
              )}
            </Section>

            {/* Enrollments */}
            <Section title={t('adminStudents.detail.enrollmentsList', 'الاشتراكات')}>
              <QueryList
                isLoading={enrollments.isLoading}
                isError={enrollments.isError}
                isEmpty={!!enrollments.data && enrollments.data.data.length === 0}
                emptyText={t('adminStudents.detail.noEnrollments', 'لا توجد اشتراكات')}
              >
                {enrollments.data?.data.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface p-3">
                    <div className="flex flex-col">
                      <span className="font-cairo text-sm text-text-primary">{e.chapter.name}</span>
                      <span className="font-cairo text-xs text-text-secondary">{e.stage.name} · {e.teacher.fullName}</span>
                    </div>
                    <Badge variant={e.status === 'ACTIVE' ? 'success' : e.status === 'PAYMENT_PENDING' ? 'warning' : 'default'}>
                      {t(`adminStudents.enrollmentStatus.${e.status}`, e.status)}
                    </Badge>
                  </div>
                ))}
              </QueryList>
            </Section>

            {/* Payments */}
            <Section title={t('adminStudents.detail.paymentsList', 'المدفوعات')}>
              <QueryList
                isLoading={payments.isLoading}
                isError={payments.isError}
                isEmpty={!!payments.data && payments.data.data.length === 0}
                emptyText={t('adminStudents.detail.noPayments', 'لا توجد مدفوعات')}
              >
                {payments.data?.data.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface p-3">
                    <div className="flex flex-col">
                      <span className="font-cairo text-sm text-text-primary">{nf(p.amount)} {p.currency}</span>
                      <span className="font-cairo text-xs text-text-secondary">{p.chapter.name} · {p.teacher.fullName}</span>
                    </div>
                    <Badge variant={p.status === 'SUCCESS' ? 'success' : p.status === 'PENDING' ? 'warning' : 'danger'}>{p.status}</Badge>
                  </div>
                ))}
              </QueryList>
            </Section>

            {/* Learning */}
            <Section title={t('adminStudents.detail.learning', 'ملخّص التعلّم')}>
              {learning.isLoading ? (
                <Muted>{t('common:status.loading', 'جاري التحميل...')}</Muted>
              ) : learning.data ? (
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={Sparkles} title={t('adminStudents.detail.quizAttempts', 'محاولات الاختبار')} value={nf(learning.data.quizAttemptsCount)} />
                  <StatCard icon={BookOpen} title={t('adminStudents.detail.completedLessons', 'دروس مكتملة')} value={nf(learning.data.completedLessonsCount)} />
                </div>
              ) : (
                <Muted>{t('adminStudents.detail.noLearning', 'لا توجد بيانات تعلّم')}</Muted>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-cairo text-sm font-semibold text-text-primary">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <p className="font-cairo text-sm text-text-muted">{children}</p>;
}
function QueryList({
  isLoading, isError, isEmpty, emptyText, children,
}: {
  isLoading: boolean; isError: boolean; isEmpty: boolean; emptyText: string; children: React.ReactNode;
}) {
  const { t } = useTranslation();
  if (isLoading) return <Muted>{t('common:status.loading', 'جاري التحميل...')}</Muted>;
  if (isError) return <Muted>{t('adminStudents.detail.error', 'تعذّر تحميل البيانات')}</Muted>;
  if (isEmpty) return <Muted>{emptyText}</Muted>;
  return <>{children}</>;
}
