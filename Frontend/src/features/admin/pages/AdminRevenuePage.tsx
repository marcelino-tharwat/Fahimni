import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, Wallet, BookOpen, CreditCard, CalendarDays, Users, Crown } from 'lucide-react';
import { useRevenueSummary, useRevenueByTeacher, useRevenueByChapter } from '@/features/admin/hooks/useAdminRevenue';
import type { RevenueByChapterRow, RevenueByTeacherRow, RevenueSummary } from '@/features/admin/types/revenue';

function MoneyCard({
  testid, icon: Icon, label, value, currency,
}: {
  testid: string; icon: typeof Wallet; label: string; value: number; currency: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-white p-4 shadow-card" data-testid={testid}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
        <Icon size={22} />
      </span>
      <div>
        <p className="font-cairo text-xs text-text-secondary">{label}</p>
        <p className="font-cairo text-xl font-bold text-navy-900">
          {value.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-muted">{currency}</span>
        </p>
      </div>
    </div>
  );
}

function CountCard({ testid, icon: Icon, label, value }: { testid: string; icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-white p-4 shadow-card" data-testid={testid}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
        <Icon size={22} />
      </span>
      <div>
        <p className="font-cairo text-xs text-text-secondary">{label}</p>
        <p className="font-cairo text-xl font-bold text-navy-900">{value.toLocaleString('ar-EG')}</p>
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
  const summaryQ = useRevenueSummary();
  const byTeacherQ = useRevenueByTeacher(1, 20);
  const byChapterQ = useRevenueByChapter(1, 20);

  const s = summaryQ.data as RevenueSummary | undefined;
  const cur = s?.currency ?? 'EGP';
  const teacherRows = (byTeacherQ.data?.data ?? []) as RevenueByTeacherRow[];
  const chapterRows = (byChapterQ.data?.data ?? []) as RevenueByChapterRow[];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5" dir="rtl" data-testid="admin-revenue-page">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-navy-900">الإيرادات</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">
          الإيرادات المؤكدة من الكورسات واشتراكات المدرسين، وتوزيعها حسب المدرس والفصل
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
            <MoneyCard testid="card-total-revenue" icon={Wallet} label="إجمالي الإيرادات المؤكدة" value={s.totalConfirmedRevenue} currency={cur} />
            <MoneyCard testid="card-course-revenue" icon={BookOpen} label="إيرادات الكورسات" value={s.confirmedCourseRevenue} currency={cur} />
            <MoneyCard testid="card-subscription-revenue" icon={CreditCard} label="إيرادات اشتراكات المدرسين" value={s.confirmedTeacherSubscriptionRevenue} currency={cur} />
            <MoneyCard testid="card-monthly-revenue" icon={CalendarDays} label="إيرادات هذا الشهر" value={s.monthlyConfirmedRevenue} currency={cur} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CountCard testid="card-free-teachers" icon={Users} label="مدرسون على الباقة المجانية" value={s.freeTeachersCount} />
            <CountCard testid="card-paid-teachers" icon={Crown} label="مدرسون مشتركون (مدفوع)" value={s.paidTeachersCount} />
            <CountCard testid="card-pending-payments" icon={CreditCard} label="مدفوعات معلقة (كورسات + اشتراكات)" value={s.pendingCoursePayments + s.pendingSubscriptionPayments} />
            <CountCard testid="card-failed-payments" icon={CreditCard} label="مدفوعات فاشلة (كورسات + اشتراكات)" value={s.failedCoursePayments + s.failedSubscriptionPayments} />
          </div>

          {s.reliabilityWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" data-testid="reliability-warnings">
              <p className="mb-1 font-cairo text-sm font-semibold text-amber-800">ملاحظات حول دقة الإيرادات</p>
              <ul className="list-disc space-y-1 pe-5 font-cairo text-xs text-amber-700">
                {s.reliabilityWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Revenue by teacher */}
      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        <h2 className="mb-3 font-cairo text-base font-bold text-navy-900">الإيرادات حسب المدرس</h2>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="revenue-by-teacher-table">
            <thead className="border-b border-border">
              <tr><Th>المدرس</Th><Th>إيرادات الكورسات</Th><Th>إيراد اشتراكه للمنصة</Th><Th>مدفوعات ناجحة</Th></tr>
            </thead>
            <tbody>
              {teacherRows.map((r) => (
                <tr key={r.teacher.id} className="border-b border-border/60">
                  <Td>
                    <Link to={`/admin/teachers/${r.teacher.id}`} data-testid="teacher-link" className="font-semibold text-accent hover:underline">
                      {r.teacher.fullName}
                    </Link>
                  </Td>
                  <Td>{r.courseRevenue.toLocaleString('ar-EG')} {cur}</Td>
                  <Td>{r.subscriptionRevenue.toLocaleString('ar-EG')} {cur}</Td>
                  <Td>{r.successfulCoursePayments}</Td>
                </tr>
              ))}
              {teacherRows.length === 0 && !byTeacherQ.isLoading && (
                <tr><td colSpan={4} className="py-8 text-center font-cairo text-sm text-text-muted">لا توجد إيرادات بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue by chapter */}
      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        <h2 className="mb-3 font-cairo text-base font-bold text-navy-900">الإيرادات حسب الفصل</h2>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="revenue-by-chapter-table">
            <thead className="border-b border-border">
              <tr><Th>الفصل</Th><Th>المدرس</Th><Th>الإيراد المؤكد</Th><Th>مدفوعات ناجحة</Th></tr>
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
                  <Td>{r.confirmedRevenue.toLocaleString('ar-EG')} {cur}</Td>
                  <Td>{r.successfulPayments}</Td>
                </tr>
              ))}
              {chapterRows.length === 0 && !byChapterQ.isLoading && (
                <tr><td colSpan={4} className="py-8 text-center font-cairo text-sm text-text-muted">لا توجد إيرادات بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
