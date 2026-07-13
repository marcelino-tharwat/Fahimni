import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/shared/hooks/useDirection';
import {
  ArrowRight, GraduationCap, Users, BookOpen, FileText, ClipboardList, Layers,
  DollarSign, Wallet, Sparkles, CreditCard, AlertTriangle, CheckCircle, Clock,
  UserCheck,
} from 'lucide-react';
import { Card, StatCard, Badge, Spinner, EmptyState, Tabs } from '@/shared/components/ui';
import { Pagination } from '../components/promo-codes';
import {
  useAdminTeacherDetail, useAdminTeacherStudents, useAdminTeacherEnrollments,
  useAdminTeacherContent, useAdminTeacherRevenue, useAdminTeacherSubscription,
  useAdminTeacherAiUsage,
} from '@/features/admin/hooks/useAdminTeacherDetail';
import type {
  AdminTeacherDetail, EnrollmentStatus, TeacherStatus,
} from '@/features/admin/types/teacherDetail';

type TabKey =
  | 'students' | 'enrollments' | 'content' | 'courseRevenue' | 'subscription' | 'aiUsage';

const PAGE_SIZE = 10;

const statusVariant: Record<TeacherStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  BANNED: 'danger',
};
const enrollmentVariant: Record<EnrollmentStatus, 'success' | 'warning' | 'default'> = {
  ACTIVE: 'success',
  PAYMENT_PENDING: 'warning',
  DEACTIVATED: 'default',
};

function useFmt() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const nf = (n: number) => n.toLocaleString(locale);
  return { nf, locale };
}

/** Shared query-state wrapper: loading / error / empty / content. */
function QueryState({
  isLoading, isError, isEmpty, onRetry, emptyIcon, emptyTitle, children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  emptyIcon: typeof Users;
  emptyTitle: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label={t('common:status.loading', 'جاري التحميل...')}>
        <Spinner />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle size={40} className="text-danger" />
        <p className="font-cairo text-text-secondary">{t('adminTeacherDetail.error', 'تعذّر تحميل البيانات')}</p>
        <button type="button" onClick={onRetry} className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100">
          {t('adminTeacherDetail.retry', 'إعادة المحاولة')}
        </button>
      </div>
    );
  }
  if (isEmpty) {
    return <div className="py-10"><EmptyState icon={emptyIcon} title={emptyTitle} /></div>;
  }
  return <>{children}</>;
}

// ── Students tab ──
function StudentsTab({ teacherId, active }: { teacherId: string; active: boolean }) {
  const { t } = useTranslation();
  const { nf } = useFmt();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch, isFetching } = useAdminTeacherStudents(
    teacherId, { page, limit: PAGE_SIZE }, active,
  );
  const students = data?.data ?? [];
  return (
    <QueryState
      isLoading={isLoading && !data}
      isError={isError}
      isEmpty={!isLoading && students.length === 0}
      onRetry={refetch}
      emptyIcon={Users}
      emptyTitle={t('adminTeacherDetail.students.empty', 'لا يوجد طلاب مرتبطون بهذا المدرس')}
    >
      <div className="flex flex-col gap-3" aria-busy={isFetching}>
        {students.map((s) => (
          <Card key={s.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-cairo font-semibold text-text-primary">{s.fullName}</span>
                <span className="font-cairo text-xs text-text-secondary">{s.email ?? s.mobile}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="success">{t('adminTeacherDetail.students.active', 'نشط')}: {nf(s.activeEnrollmentsCount)}</Badge>
                {s.pendingEnrollmentsCount > 0 && (
                  <Badge variant="warning">{t('adminTeacherDetail.students.pending', 'معلّق')}: {nf(s.pendingEnrollmentsCount)}</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {s.enrollments.map((e) => (
                <Badge key={e.id} variant={enrollmentVariant[e.status]}>{e.chapter.name}</Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {data && data.meta.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.meta.totalPages} onPageChange={setPage} isLoading={isFetching} />
      )}
    </QueryState>
  );
}

// ── Student enrollments tab ──
function EnrollmentsTab({ teacherId, active }: { teacherId: string; active: boolean }) {
  const { t } = useTranslation();
  const { nf } = useFmt();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EnrollmentStatus | 'ALL'>('ALL');
  const { data, isLoading, isError, refetch, isFetching } = useAdminTeacherEnrollments(
    teacherId, { page, limit: PAGE_SIZE, ...(status !== 'ALL' ? { status } : {}) }, active,
  );
  const rows = data?.data ?? [];
  const options: (EnrollmentStatus | 'ALL')[] = ['ALL', 'ACTIVE', 'PAYMENT_PENDING', 'DEACTIVATED'];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('adminTeacherDetail.enrollments.filter', 'تصفية الحالة')}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => { setStatus(opt); setPage(1); }}
            className={`rounded-btn border px-3 py-1.5 font-cairo text-sm font-medium transition-colors ${
              status === opt ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-secondary hover:bg-gray-100'
            }`}
          >
            {t(`adminTeacherDetail.enrollments.status.${opt}`, opt)}
          </button>
        ))}
      </div>
      <QueryState
        isLoading={isLoading && !data}
        isError={isError}
        isEmpty={!isLoading && rows.length === 0}
        onRetry={refetch}
        emptyIcon={BookOpen}
        emptyTitle={t('adminTeacherDetail.enrollments.empty', 'لا توجد اشتراكات لهذا المدرس')}
      >
        <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card" aria-busy={isFetching}>
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-text-secondary">
                <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.enrollments.student', 'الطالب')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.enrollments.chapter', 'الفصل')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.enrollments.statusCol', 'الحالة')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.enrollments.price', 'السعر')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-cairo text-text-primary">{e.student.fullName}</td>
                  <td className="px-4 py-2.5 font-cairo text-text-secondary">{e.chapter.name}</td>
                  <td className="px-4 py-2.5"><Badge variant={enrollmentVariant[e.status]}>{t(`adminTeacherDetail.enrollments.status.${e.status}`, e.status)}</Badge></td>
                  <td className="px-4 py-2.5 font-cairo text-text-primary">{nf(e.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.meta.totalPages > 1 && (
          <Pagination currentPage={page} totalPages={data.meta.totalPages} onPageChange={setPage} isLoading={isFetching} />
        )}
      </QueryState>
    </div>
  );
}

// ── Content tab ──
function ContentTab({ teacherId, active }: { teacherId: string; active: boolean }) {
  const { t } = useTranslation();
  const { nf } = useFmt();
  const { data, isLoading, isError, refetch } = useAdminTeacherContent(teacherId, active);
  return (
    <QueryState
      isLoading={isLoading && !data}
      isError={isError}
      isEmpty={!isLoading && !!data && data.stages.length === 0}
      onRetry={refetch}
      emptyIcon={Layers}
      emptyTitle={t('adminTeacherDetail.content.empty', 'لا يوجد محتوى لهذا المدرس')}
    >
      {data && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Layers} title={t('adminTeacherDetail.content.stages', 'المراحل')} value={nf(data.counts.stagesCount)} />
            <StatCard icon={BookOpen} title={t('adminTeacherDetail.content.chapters', 'الفصول')} value={nf(data.counts.chaptersCount)} />
            <StatCard icon={FileText} title={t('adminTeacherDetail.content.lessons', 'الدروس')} value={nf(data.counts.lessonsCount)} />
            <StatCard icon={ClipboardList} title={t('adminTeacherDetail.content.quizzes', 'الاختبارات')} value={nf(data.counts.quizzesCount)} />
            <StatCard icon={CheckCircle} title={t('adminTeacherDetail.content.published', 'منشورة')} value={nf(data.counts.publishedQuizzesCount)} />
            <StatCard icon={FileText} title={t('adminTeacherDetail.content.draft', 'مسودة')} value={nf(data.counts.draftQuizzesCount)} />
          </div>
          <div className="flex flex-col gap-3">
            {data.stages.map((st) => (
              <Card key={st.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-accent" />
                  <span className="font-cairo font-semibold text-text-primary">{st.name}</span>
                  <Badge variant="default">{t('adminTeacherDetail.content.chaptersCount', '{{count}} فصل', { count: st.chaptersCount })}</Badge>
                </div>
                <div className="flex flex-col gap-1 ps-6">
                  {st.chapters.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-cairo text-text-primary">{c.name}</span>
                      <span className="font-cairo text-xs text-text-secondary">
                        {t('adminTeacherDetail.content.lessonsShort', '{{count}} درس', { count: c.lessonsCount })}
                        {' · '}
                        {t('adminTeacherDetail.content.quizzesShort', '{{count}} اختبار', { count: c.quizzesCount })}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </QueryState>
  );
}

// ── Course revenue tab (إيرادات محتوى المدرس) ──
function CourseRevenueTab({ teacherId, active }: { teacherId: string; active: boolean }) {
  const { t } = useTranslation();
  const { nf } = useFmt();
  const { data, isLoading, isError, refetch } = useAdminTeacherRevenue(teacherId, active);
  const money = (n: number) => `${nf(Math.round(n))} ${data?.currency ?? 'EGP'}`;
  return (
    <QueryState
      isLoading={isLoading && !data}
      isError={isError}
      isEmpty={false}
      onRetry={refetch}
      emptyIcon={DollarSign}
      emptyTitle=""
    >
      {data && (
        <div className="flex flex-col gap-4">
          <Card className="border-s-4 border-s-success bg-success/5">
            <p className="font-cairo text-sm font-semibold text-text-primary">
              {t('adminTeacherDetail.tabs.courseRevenue', 'إيرادات محتوى المدرس')}
            </p>
            <p className="font-cairo text-xs text-text-secondary">
              {t('adminTeacherDetail.courseRevenue.note', 'أموال دفعها الطلاب مقابل محتوى هذا المدرس')}
            </p>
          </Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={DollarSign} title={t('adminTeacherDetail.courseRevenue.confirmed', 'الإيراد المؤكد')} value={money(data.confirmedCourseRevenue)} />
            <StatCard icon={Clock} title={t('adminTeacherDetail.courseRevenue.monthly', 'إيراد هذا الشهر')} value={money(data.monthlyConfirmedCourseRevenue)} />
            <StatCard icon={CheckCircle} title={t('adminTeacherDetail.courseRevenue.successCount', 'مدفوعات ناجحة')} value={nf(data.coursePayments.successCount)} />
          </div>
          {data.coursePayments.recent.length === 0 ? (
            <EmptyState icon={DollarSign} title={t('adminTeacherDetail.courseRevenue.empty', 'لا توجد مدفوعات كورسات')} />
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
              <table className="w-full min-w-[640px] text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-text-secondary">
                    <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.courseRevenue.student', 'الطالب')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.courseRevenue.chapter', 'الفصل')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.courseRevenue.amount', 'المبلغ')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.courseRevenue.statusCol', 'الحالة')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coursePayments.recent.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-cairo text-text-primary">{p.student.fullName}</td>
                      <td className="px-4 py-2.5 font-cairo text-text-secondary">{p.chapter.name}</td>
                      <td className="px-4 py-2.5 font-cairo text-text-primary">{money(p.amount)}</td>
                      <td className="px-4 py-2.5"><Badge variant={p.status === 'SUCCESS' ? 'success' : p.status === 'PENDING' ? 'warning' : 'danger'}>{p.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </QueryState>
  );
}

// ── Subscription payments tab (مدفوعات باقة المدرس) ──
function SubscriptionTab({ teacherId, active }: { teacherId: string; active: boolean }) {
  const { t } = useTranslation();
  const { nf } = useFmt();
  const { data, isLoading, isError, refetch } = useAdminTeacherSubscription(teacherId, active);
  const money = (n: number, c = 'EGP') => `${nf(Math.round(n))} ${c}`;
  return (
    <QueryState
      isLoading={isLoading && !data}
      isError={isError}
      isEmpty={false}
      onRetry={refetch}
      emptyIcon={Wallet}
      emptyTitle=""
    >
      {data && (
        <div className="flex flex-col gap-4">
          <Card className="border-s-4 border-s-accent bg-accent/5">
            <p className="font-cairo text-sm font-semibold text-text-primary">
              {t('adminTeacherDetail.tabs.subscription', 'مدفوعات باقة المدرس')}
            </p>
            <p className="font-cairo text-xs text-text-secondary">
              {t('adminTeacherDetail.subscription.note', 'إيراد للمنصة يدفعه المدرس مقابل باقته (منفصل عن إيرادات الكورسات)')}
            </p>
          </Card>

          {data.currentSubscription ? (
            <Card className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-cairo font-semibold text-text-primary">{data.currentSubscription.plan.displayName}</span>
                <span className="font-cairo text-xs text-text-secondary">{data.currentSubscription.billingInterval}</span>
              </div>
              <Badge variant={data.currentSubscription.status === 'ACTIVE' ? 'success' : 'warning'}>
                {data.currentSubscription.status}
              </Badge>
            </Card>
          ) : (
            <Card><span className="font-cairo text-sm text-text-secondary">{t('adminTeacherDetail.subscription.noPlan', 'لا توجد باقة حالية')}</span></Card>
          )}

          {data.pendingPayment && (
            <Card className="border-warning/40 bg-warning/5">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-warning" />
                <span className="font-cairo text-sm text-text-primary">
                  {t('adminTeacherDetail.subscription.pending', 'دفعة معلّقة')}: {money(data.pendingPayment.amount, data.pendingPayment.currency)}
                </span>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={CheckCircle} title={t('adminTeacherDetail.subscription.successCount', 'مدفوعات ناجحة')} value={nf(data.latestSuccessfulPayments.length)} />
            <StatCard icon={AlertTriangle} title={t('adminTeacherDetail.subscription.failedCount', 'مدفوعات فاشلة')} value={nf(data.failedPaymentsCount)} />
            <StatCard icon={Wallet} title={t('adminTeacherDetail.subscription.pendingLabel', 'دفعة معلّقة')} value={data.pendingPayment ? nf(1) : nf(0)} />
          </div>

          {data.latestSuccessfulPayments.length === 0 ? (
            <EmptyState icon={Wallet} title={t('adminTeacherDetail.subscription.empty', 'لا توجد مدفوعات باقة')} />
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
              <table className="w-full min-w-[560px] text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-text-secondary">
                    <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.subscription.plan', 'الباقة')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.subscription.amount', 'المبلغ')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.subscription.interval', 'الفترة')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.latestSuccessfulPayments.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-cairo text-text-primary">{p.plan.displayName}</td>
                      <td className="px-4 py-2.5 font-cairo text-text-primary">{money(p.amount, p.currency)}</td>
                      <td className="px-4 py-2.5 font-cairo text-text-secondary">{p.billingInterval}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </QueryState>
  );
}

// ── AI usage tab ──
function AiUsageTab({ teacherId, active }: { teacherId: string; active: boolean }) {
  const { t } = useTranslation();
  const { nf } = useFmt();
  const { data, isLoading, isError, refetch } = useAdminTeacherAiUsage(teacherId, active);
  return (
    <QueryState
      isLoading={isLoading && !data}
      isError={isError}
      isEmpty={!isLoading && !!data && data.totalEvents === 0}
      onRetry={refetch}
      emptyIcon={Sparkles}
      emptyTitle={t('adminTeacherDetail.aiUsage.empty', 'لا يوجد استخدام للذكاء الاصطناعي')}
    >
      {data && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={Sparkles} title={t('adminTeacherDetail.aiUsage.totalEvents', 'إجمالي العمليات')} value={nf(data.totalEvents)} />
            <StatCard icon={Sparkles} title={t('adminTeacherDetail.aiUsage.totalUnits', 'إجمالي الوحدات')} value={nf(data.totalUnits)} />
            <StatCard icon={Clock} title={t('adminTeacherDetail.aiUsage.currentMonth', 'هذا الشهر')} value={nf(data.currentMonth.events)} />
          </div>
          <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
            <table className="w-full min-w-[420px] text-start text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50 text-text-secondary">
                  <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.aiUsage.type', 'النوع')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.aiUsage.events', 'العمليات')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('adminTeacherDetail.aiUsage.units', 'الوحدات')}</th>
                </tr>
              </thead>
              <tbody>
                {data.byType.map((r) => (
                  <tr key={r.type} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-cairo text-text-primary">{t(`adminTeacherDetail.aiUsage.types.${r.type}`, r.type)}</td>
                    <td className="px-4 py-2.5 font-cairo text-text-primary">{nf(r.events)}</td>
                    <td className="px-4 py-2.5 font-cairo text-text-primary">{nf(r.units)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </QueryState>
  );
}

function TeacherHeader({ detail }: { detail: AdminTeacherDetail }) {
  const { t } = useTranslation();
  const { nf } = useFmt();
  const { teacher, profile, stats, currentSubscription, pendingSubscriptionPayment, revenue } = detail;
  const money = (n: number) => `${nf(Math.round(n))} ${revenue.currency}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Identity card */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10">
            {profile.photoUrl
              ? <img src={profile.photoUrl} alt={teacher.fullName} className="h-full w-full object-cover" />
              : <GraduationCap size={28} className="text-accent" />}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-cairo text-xl font-bold text-text-primary">{teacher.fullName}</h1>
              <Badge variant={statusVariant[teacher.status]}>{t(`adminTeacherDetail.status.${teacher.status}`, teacher.status)}</Badge>
              {profile.subject && <Badge variant="cyan">{profile.subject}</Badge>}
            </div>
            <span className="font-cairo text-sm text-text-secondary">{teacher.email ?? '—'} · {teacher.mobile}</span>
            {profile.bio && <span className="font-cairo text-xs text-text-muted">{profile.bio}</span>}
          </div>
        </div>
        {currentSubscription && (
          <div className="flex flex-col items-start gap-1 rounded-card bg-accent/5 p-3 sm:items-end">
            <span className="font-cairo text-xs text-text-secondary">{t('adminTeacherDetail.currentPlan', 'الباقة الحالية')}</span>
            <span className="font-cairo font-semibold text-text-primary">{currentSubscription.plan.displayName}</span>
            <Badge variant={currentSubscription.status === 'ACTIVE' ? 'success' : 'warning'}>{currentSubscription.status}</Badge>
          </div>
        )}
      </Card>

      {pendingSubscriptionPayment && (
        <Card className="flex items-center gap-2 border-warning/40 bg-warning/5">
          <CreditCard size={16} className="text-warning" />
          <span className="font-cairo text-sm text-text-primary">
            {t('adminTeacherDetail.pendingPaymentCard', 'دفعة باقة معلّقة')}: {money(pendingSubscriptionPayment.amount)} — {pendingSubscriptionPayment.plan.displayName}
          </span>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Users} title={t('adminTeacherDetail.stats.students', 'الطلاب')} value={nf(stats.studentsCount)} />
        <StatCard icon={UserCheck} title={t('adminTeacherDetail.stats.enrollments', 'الاشتراكات')} value={nf(stats.enrollmentsCount)} />
        <StatCard icon={Layers} title={t('adminTeacherDetail.stats.stages', 'المراحل')} value={nf(stats.stagesCount)} />
        <StatCard icon={BookOpen} title={t('adminTeacherDetail.stats.chapters', 'الفصول')} value={nf(stats.chaptersCount)} />
        <StatCard icon={FileText} title={t('adminTeacherDetail.stats.lessons', 'الدروس')} value={nf(stats.lessonsCount)} />
        <StatCard icon={ClipboardList} title={t('adminTeacherDetail.stats.quizzes', 'الاختبارات')} value={nf(stats.quizzesCount)} />
      </div>

      {/* Revenue separation: two clearly-labelled, distinct figures. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="flex items-center gap-4 border-s-4 border-s-success">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-success/10">
            <DollarSign size={24} className="text-success" />
          </div>
          <div className="flex flex-col">
            <span className="font-cairo text-2xl font-bold text-text-primary">{money(revenue.confirmedCourseRevenue)}</span>
            <span className="font-cairo text-sm text-text-secondary">{t('adminTeacherDetail.tabs.courseRevenue', 'إيرادات محتوى المدرس')}</span>
          </div>
        </Card>
        <Card className="flex items-center gap-4 border-s-4 border-s-accent">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-accent/10">
            <Wallet size={24} className="text-accent" />
          </div>
          <div className="flex flex-col">
            <span className="font-cairo text-2xl font-bold text-text-primary">{money(revenue.confirmedSubscriptionPayments)}</span>
            <span className="font-cairo text-sm text-text-secondary">{t('adminTeacherDetail.tabs.subscription', 'مدفوعات باقة المدرس')}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function AdminTeacherDetailPage() {
  const { t } = useTranslation();
  const dir = useDirection();
  const { teacherId = '' } = useParams<{ teacherId: string }>();
  const [tab, setTab] = useState<TabKey>('students');
  const { data, isLoading, isError, refetch } = useAdminTeacherDetail(teacherId);

  const backLink = (
    <Link to="/admin/teachers" className="inline-flex items-center gap-1.5 font-cairo text-sm font-medium text-accent hover:underline">
      <ArrowRight size={16} className="rtl:rotate-180" />
      {t('adminTeacherDetail.back', 'عودة إلى المدرسين')}
    </Link>
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'students', label: t('adminTeacherDetail.tabs.students', 'الطلاب') },
    { key: 'enrollments', label: t('adminTeacherDetail.tabs.enrollments', 'اشتراكات الطلاب') },
    { key: 'content', label: t('adminTeacherDetail.tabs.content', 'المحتوى') },
    { key: 'courseRevenue', label: t('adminTeacherDetail.tabs.courseRevenue', 'إيرادات محتوى المدرس') },
    { key: 'subscription', label: t('adminTeacherDetail.tabs.subscription', 'مدفوعات باقة المدرس') },
    { key: 'aiUsage', label: t('adminTeacherDetail.tabs.aiUsage', 'استخدام الذكاء الاصطناعي') },
  ];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" dir={dir}>
      {backLink}

      {isLoading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label={t('common:status.loading', 'جاري التحميل...')}>
          <Spinner />
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertTriangle size={48} className="text-danger" />
          <p className="font-cairo text-text-secondary">{t('adminTeacherDetail.error', 'تعذّر تحميل بيانات المدرس')}</p>
          <button type="button" onClick={() => refetch()} className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100">
            {t('adminTeacherDetail.retry', 'إعادة المحاولة')}
          </button>
        </div>
      ) : (
        <>
          <TeacherHeader detail={data} />

          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <Tabs tabs={tabs} activeTab={tab} onTabChange={(k) => setTab(k as TabKey)} />
            </div>
            <div role="tabpanel">
              {tab === 'students' && <StudentsTab teacherId={teacherId} active />}
              {tab === 'enrollments' && <EnrollmentsTab teacherId={teacherId} active />}
              {tab === 'content' && <ContentTab teacherId={teacherId} active />}
              {tab === 'courseRevenue' && <CourseRevenueTab teacherId={teacherId} active />}
              {tab === 'subscription' && <SubscriptionTab teacherId={teacherId} active />}
              {tab === 'aiUsage' && <AiUsageTab teacherId={teacherId} active />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
