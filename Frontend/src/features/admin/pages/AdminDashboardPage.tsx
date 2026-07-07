import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, UserCheck, UserX, Layers, BookOpen, FileText,
  FileStack, ClipboardList, DollarSign, CalendarClock, CreditCard, Bell,
  BadgeCheck, Sparkles, Award, TrendingUp, AlertTriangle, ChevronLeft,
} from 'lucide-react';
import { Card, StatCard, Spinner, EmptyState } from '@/shared/components/ui';
import { useAdminStats } from '@/features/admin/hooks/useAdminStats';
import type { AdminStats } from '@/features/admin/types/stats';

const nf = (n: number) => n.toLocaleString('ar-EG');
const money = (n: number, currency: string) => `${nf(Math.round(n))} ${currency}`;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-cairo text-lg font-bold text-text-primary">{children}</h2>
  );
}

/** Card that navigates to a detail page when clicked. */
function LinkStatCard({
  to, title, value, icon: Icon, accent,
}: {
  to: string; title: string; value: string | number;
  icon: typeof Users; accent?: 'amber' | 'cyan';
}) {
  return (
    <Link to={to} className="block focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 rounded-card">
      <Card className="flex items-center gap-4 transition-shadow hover:shadow-elevated">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-card ${accent === 'amber' ? 'bg-amber-100' : 'bg-accent/10'}`}>
          <Icon size={24} className={accent === 'amber' ? 'text-amber-600' : 'text-accent'} />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="font-cairo text-2xl font-bold text-text-primary">{value}</span>
          <span className="font-cairo text-sm text-text-secondary">{title}</span>
        </div>
        <ChevronLeft size={18} className="text-text-muted rtl:rotate-180" />
      </Card>
    </Link>
  );
}

function TopTeachersTable<T extends { teacherId: string; fullName: string }>({
  title, rows, valueLabel, renderValue, emptyText,
}: {
  title: string;
  rows: T[];
  valueLabel: string;
  renderValue: (row: T) => string;
  emptyText: string;
}) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState icon={Award} title={emptyText} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="py-2 text-start font-medium">{t('adminDashboard.teacher', 'المدرس')}</th>
                <th className="py-2 text-start font-medium">{valueLabel}</th>
                <th className="py-2 text-end font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.teacherId} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 font-cairo text-text-primary">{row.fullName}</td>
                  <td className="py-2.5 font-cairo font-semibold text-text-primary">{renderValue(row)}</td>
                  <td className="py-2.5 text-end">
                    <Link
                      to={`/admin/teachers/${row.teacherId}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      {t('adminDashboard.viewDetails', 'عرض')}
                      <ChevronLeft size={14} className="rtl:rotate-180" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } = useAdminStats();

  const header = (
    <div>
      <h1 className="font-cairo text-2xl font-bold text-text-primary">
        {t('adminDashboard.title', 'لوحة تحكم المشرف')}
      </h1>
      <p className="mt-1 font-cairo text-sm text-text-secondary">
        {t('adminDashboard.subtitle', 'نظرة عامة على المنصة')}
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="flex items-center justify-center py-20" role="status" aria-label={t('common:status.loading', 'جاري التحميل...')}>
          <Spinner />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400" />
          <p className="font-cairo text-text-secondary">
            {t('common:status.error', 'حدث خطأ أثناء تحميل البيانات')}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100"
          >
            {t('common:status.retry', 'إعادة المحاولة')}
          </button>
        </div>
      </div>
    );
  }

  const s: AdminStats = data;
  const { currency } = s.finance;

  return (
    <div className="flex flex-col gap-8" aria-busy={isFetching}>
      {header}

      {/* Users */}
      <section className="flex flex-col gap-3">
        <SectionTitle>{t('adminDashboard.usersSection', 'المستخدمون')}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard icon={Users} title={t('adminDashboard.totalTeachers', 'إجمالي المدرسين')} value={nf(s.users.totalTeachers)} />
          <StatCard icon={UserCheck} title={t('adminDashboard.activeTeachers', 'المدرسون النشطون')} value={nf(s.users.activeTeachers)} />
          <StatCard icon={GraduationCap} title={t('adminDashboard.totalStudents', 'إجمالي الطلاب')} value={nf(s.users.totalStudents)} />
          <StatCard icon={UserCheck} title={t('adminDashboard.activeStudents', 'الطلاب النشطون')} value={nf(s.users.activeStudents)} />
          <LinkStatCard
            to="/admin/students?filter=unassigned"
            icon={UserX}
            accent="amber"
            title={t('adminDashboard.studentsWithoutTeacher', 'طلاب بدون مدرس')}
            value={nf(s.users.studentsWithoutTeacher)}
          />
        </div>
      </section>

      {/* Finance */}
      <section className="flex flex-col gap-3">
        <SectionTitle>{t('adminDashboard.financeSection', 'الإيرادات')}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LinkStatCard
            to="/admin/revenue"
            icon={DollarSign}
            title={t('adminDashboard.confirmedRevenue', 'الإيرادات المؤكدة')}
            value={money(s.finance.confirmedRevenue, currency)}
          />
          <StatCard icon={CalendarClock} title={t('adminDashboard.monthlyConfirmedRevenue', 'إيرادات هذا الشهر')} value={money(s.finance.monthlyConfirmedRevenue, currency)} />
          <StatCard icon={CreditCard} title={t('adminDashboard.estimatedSubscriptionRevenue', 'إيراد الاشتراكات (تقديري)')} value={money(s.finance.estimatedSubscriptionRevenue, currency)} />
        </div>
        {s.finance.reliabilityWarnings.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-cairo text-sm font-semibold text-amber-800">
                {t('adminDashboard.reliabilityTitle', 'ملاحظات حول دقة الإيرادات')}
              </span>
            </div>
            <ul className="list-disc space-y-1 ps-6 font-cairo text-xs text-amber-800">
              {s.finance.reliabilityWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Operations */}
      <section className="flex flex-col gap-3">
        <SectionTitle>{t('adminDashboard.operationsSection', 'العمليات')}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LinkStatCard
            to="/admin/teacher-requests"
            icon={Bell}
            accent="amber"
            title={t('adminDashboard.pendingTeacherRequests', 'طلبات تسجيل مدرسين معلقة')}
            value={nf(s.operations.pendingTeacherRequests)}
          />
          <StatCard icon={BadgeCheck} title={t('adminDashboard.activeTeacherSubscriptions', 'اشتراكات نشطة')} value={nf(s.operations.activeTeacherSubscriptions)} />
          <StatCard icon={ClipboardList} title={t('adminDashboard.pendingTeacherSubscriptionRequests', 'طلبات اشتراك معلقة')} value={nf(s.operations.pendingTeacherSubscriptionRequests)} />
        </div>
      </section>

      {/* Content */}
      <section className="flex flex-col gap-3">
        <SectionTitle>{t('adminDashboard.contentSection', 'المحتوى')}</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <StatCard icon={Layers} title={t('adminDashboard.totalStages', 'المراحل')} value={nf(s.content.totalStages)} />
          <StatCard icon={BookOpen} title={t('adminDashboard.totalChapters', 'الفصول')} value={nf(s.content.totalChapters)} />
          <StatCard icon={FileText} title={t('adminDashboard.totalLessons', 'الدروس')} value={nf(s.content.totalLessons)} />
          <StatCard icon={FileStack} title={t('adminDashboard.totalMaterials', 'الملفات')} value={nf(s.content.totalMaterials)} />
          <StatCard icon={ClipboardList} title={t('adminDashboard.totalQuizzes', 'الاختبارات')} value={nf(s.content.totalQuizzes)} />
          <StatCard icon={BadgeCheck} title={t('adminDashboard.publishedQuizzes', 'اختبارات منشورة')} value={nf(s.content.publishedQuizzes)} />
          <StatCard icon={FileText} title={t('adminDashboard.draftQuizzes', 'اختبارات مسودة')} value={nf(s.content.draftQuizzes)} />
        </div>
      </section>

      {/* Learning */}
      <section className="flex flex-col gap-3">
        <SectionTitle>{t('adminDashboard.learningSection', 'التعلّم')}</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={BookOpen} title={t('adminDashboard.totalEnrollments', 'إجمالي الاشتراكات')} value={nf(s.learning.totalEnrollments)} />
          <StatCard icon={UserCheck} title={t('adminDashboard.activeEnrollments', 'اشتراكات نشطة')} value={nf(s.learning.activeEnrollments)} />
          <StatCard icon={CalendarClock} title={t('adminDashboard.pendingEnrollments', 'مدفوعات معلقة')} value={nf(s.learning.pendingEnrollments)} />
          <StatCard icon={ClipboardList} title={t('adminDashboard.quizAttempts', 'محاولات الاختبارات')} value={nf(s.learning.quizAttempts)} />
          <StatCard icon={TrendingUp} title={t('adminDashboard.averageQuizScore', 'متوسط الدرجات')} value={`${nf(s.learning.averageQuizScore)}%`} />
        </div>
      </section>

      {/* AI usage */}
      <section className="flex flex-col gap-3">
        <SectionTitle>{t('adminDashboard.aiSection', 'استخدام الذكاء الاصطناعي')}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard icon={Sparkles} title={t('adminDashboard.quizGenerations', 'توليد اختبارات بالذكاء الاصطناعي')} value={nf(s.ai.quizGenerations)} />
          <StatCard icon={Sparkles} title={t('adminDashboard.essayGrading', 'تصحيح مقالات بالذكاء الاصطناعي')} value={nf(s.ai.essayGrading)} />
        </div>
      </section>

      {/* Top teachers */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopTeachersTable
          title={t('adminDashboard.topByRevenue', 'أعلى المدرسين إيراداً')}
          rows={s.topTeachers.byRevenue}
          valueLabel={t('adminDashboard.revenue', 'الإيراد')}
          renderValue={(r) => money(r.revenue, currency)}
          emptyText={t('adminDashboard.noTopTeachers', 'لا توجد بيانات بعد')}
        />
        <TopTeachersTable
          title={t('adminDashboard.topByStudents', 'أعلى المدرسين عدداً للطلاب')}
          rows={s.topTeachers.byStudents}
          valueLabel={t('adminDashboard.students', 'الطلاب')}
          renderValue={(r) => nf(r.studentCount)}
          emptyText={t('adminDashboard.noTopTeachers', 'لا توجد بيانات بعد')}
        />
      </section>
    </div>
  );
}
