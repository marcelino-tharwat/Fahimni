import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, Wallet, BookOpen, CreditCard, CalendarDays, Users, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/components/ui';
import { useRevenueSummary, useRevenueByTeacher, useRevenueByChapter } from '@/features/admin/hooks/useAdminRevenue';
import type { RevenueByChapterRow, RevenueByTeacherRow, RevenueSummary } from '@/features/admin/types/revenue';

const WARNING_MAP: Record<string, string> = {
  'إيرادات الكورسات المؤكدة تحتسب فقط مدفوعات Paymob الناجحة؛ الاشتراكات المجانية أو عبر الأكواد غير محتسبة.': 'adminDashboard.reliabilityWarning1',
  'إيراد اشتراكات المدرسين يحتسب فقط مدفوعات الاشتراك الناجحة؛ الباقة المجانية لا تولّد أي إيراد.': 'adminDashboard.reliabilityWarning2',
  'المدفوعات المعلقة والفاشلة غير محتسبة في الإيرادات وتظهر في مقاييس المعلق/الفاشل فقط.': 'adminDashboard.reliabilityWarning3',
  'المبالغ المستردة والإلغاءات غير محتسبة في الإيرادات.': 'adminDashboard.reliabilityWarning4',
  'إيراد اشتراكات المدرسين محسوب من مدفوعات الاشتراك المؤكدة (القيمة التقديرية غير مستخدمة).': 'adminDashboard.reliabilityWarning5',
  'ترتيب المدرسين حسب الإيراد يعتمد على إيرادات الكورسات المملوكة للمدرس فقط؛ مدفوعات اشتراكات المدرسين تُعد إيراداً للمنصة وليست إيراداً للمدرس.': 'adminDashboard.reliabilityWarning6',
};

function MoneyCard({
  testid, icon: Icon, label, value, currency, locale,
}: {
  testid: string; icon: typeof Wallet; label: string; value: number; currency: string; locale: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-white p-4 shadow-card" data-testid={testid}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
        <Icon size={22} />
      </span>
      <div>
        <p className="font-cairo text-xs text-text-secondary">{label}</p>
        <p className="font-cairo text-xl font-bold text-navy-900">
          {value.toLocaleString(locale)} <span className="text-xs font-normal text-text-muted">{currency}</span>
        </p>
      </div>
    </div>
  );
}

function CountCard({ testid, icon: Icon, label, value, locale }: { testid: string; icon: typeof Users; label: string; value: number; locale: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-white p-4 shadow-card" data-testid={testid}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
        <Icon size={22} />
      </span>
      <div>
        <p className="font-cairo text-xs text-text-secondary">{label}</p>
        <p className="font-cairo text-xl font-bold text-navy-900">{value.toLocaleString(locale)}</p>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 font-cairo text-sm text-text-primary">{children}</td>;
}

export function AdminRevenuePage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const summaryQ = useRevenueSummary();
  const byTeacherQ = useRevenueByTeacher(1, 20);
  const byChapterQ = useRevenueByChapter(1, 20);

  const s = summaryQ.data as RevenueSummary | undefined;
  const cur = s?.currency ?? 'EGP';
  const teacherRows = (byTeacherQ.data?.data ?? []) as RevenueByTeacherRow[];
  const chapterRows = (byChapterQ.data?.data ?? []) as RevenueByChapterRow[];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" data-testid="admin-revenue-page">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('adminRevenue.title')}</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">
          {t('adminRevenue.subtitle')}
        </p>
      </div>

      {summaryQ.isLoading ? (
        <div className="flex items-center justify-center py-16" role="status"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
      ) : summaryQ.isError || !s ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-danger" />
          <p className="font-cairo text-sm text-text-secondary">تعذّر تحميل ملخص الإيرادات</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="revenue-cards">
            <MoneyCard testid="card-total-revenue" icon={Wallet} label={t('adminRevenue.cardTotalRevenue')} value={s.totalConfirmedRevenue} currency={cur} locale={locale} />
            <MoneyCard testid="card-course-revenue" icon={BookOpen} label={t('adminRevenue.cardCourseRevenue')} value={s.confirmedCourseRevenue} currency={cur} locale={locale} />
            <MoneyCard testid="card-subscription-revenue" icon={CreditCard} label={t('adminRevenue.cardSubscriptionRevenue')} value={s.confirmedTeacherSubscriptionRevenue} currency={cur} locale={locale} />
            <MoneyCard testid="card-monthly-revenue" icon={CalendarDays} label={t('adminRevenue.cardMonthlyRevenue')} value={s.monthlyConfirmedRevenue} currency={cur} locale={locale} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CountCard testid="card-free-teachers" icon={Users} label={t('adminRevenue.cardFreeTeachers')} value={s.freeTeachersCount} locale={locale} />
            <CountCard testid="card-paid-teachers" icon={Crown} label={t('adminRevenue.cardPaidTeachers')} value={s.paidTeachersCount} locale={locale} />
            <CountCard testid="card-pending-payments" icon={CreditCard} label={t('adminRevenue.cardPendingPayments')} value={s.pendingCoursePayments + s.pendingSubscriptionPayments} locale={locale} />
            <CountCard testid="card-failed-payments" icon={CreditCard} label={t('adminRevenue.cardFailedPayments')} value={s.failedCoursePayments + s.failedSubscriptionPayments} locale={locale} />
          </div>

          {s.reliabilityWarnings.length > 0 && (
            <Card className="border-amber-200 bg-amber-50" data-testid="reliability-warnings">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="font-cairo text-sm font-semibold text-amber-800">{t('adminRevenue.reliabilityTitle')}</span>
              </div>
              <ul className="list-disc space-y-1 ps-6 font-cairo text-xs text-amber-800">
                {s.reliabilityWarnings.map((w, i) => <li key={i}>{t(WARNING_MAP[w] ?? w)}</li>)}
              </ul>
            </Card>
          )}
        </>
      )}

      {/* Revenue by teacher */}
      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        <h2 className="mb-3 font-cairo text-base font-bold text-navy-900">{t('adminRevenue.byTeacherTitle')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="revenue-by-teacher-table">
            <thead className="border-b border-border">
              <tr><Th>{t('adminRevenue.colTeacher')}</Th><Th>{t('adminRevenue.colCourseRevenue')}</Th><Th>{t('adminRevenue.colSubscriptionRevenue')}</Th><Th>{t('adminRevenue.colSuccessfulPayments')}</Th></tr>
            </thead>
            <tbody>
              {teacherRows.map((r) => (
                <tr key={r.teacher.id} className="border-b border-border/60">
                  <Td>
                    <Link to={`/admin/teachers/${r.teacher.id}`} data-testid="teacher-link" className="font-semibold text-accent hover:underline">
                      {r.teacher.fullName}
                    </Link>
                  </Td>
                  <Td>{r.courseRevenue.toLocaleString(locale)} {cur}</Td>
                  <Td>{r.subscriptionRevenue.toLocaleString(locale)} {cur}</Td>
                  <Td>{r.successfulCoursePayments}</Td>
                </tr>
              ))}
              {teacherRows.length === 0 && !byTeacherQ.isLoading && (
                <tr><td colSpan={4} className="py-8 text-center font-cairo text-sm text-text-muted">{t('adminRevenue.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue by chapter */}
      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        <h2 className="mb-3 font-cairo text-base font-bold text-navy-900">{t('adminRevenue.byChapterTitle')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="revenue-by-chapter-table">
            <thead className="border-b border-border">
              <tr><Th>{t('adminRevenue.colChapter')}</Th><Th>{t('adminRevenue.colTeacher')}</Th><Th>{t('adminRevenue.colConfirmedRevenue')}</Th><Th>{t('adminRevenue.colSuccessfulPayments')}</Th></tr>
            </thead>
            <tbody>
              {chapterRows.map((r) => (
                <tr key={r.chapter.id} className="border-b border-border/60">
                  <Td>{r.chapter.name}</Td>
                  <Td>
                    <Link to={`/admin/teachers/${r.teacher.id}`} data-testid="teacher-link" className="font-semibold text-accent hover:underline">
                      {r.teacher.fullName}
                    </Link>
                  </Td>
                  <Td>{r.confirmedRevenue.toLocaleString(locale)} {cur}</Td>
                  <Td>{r.successfulPayments}</Td>
                </tr>
              ))}
              {chapterRows.length === 0 && !byChapterQ.isLoading && (
                <tr><td colSpan={4} className="py-8 text-center font-cairo text-sm text-text-muted">{t('adminRevenue.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
