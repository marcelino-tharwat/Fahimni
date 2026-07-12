import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  RadialBarChart, RadialBar,
} from 'recharts';
import {
  Users, GraduationCap, UserCheck, UserX, UserMinus, Layers, BookOpen, FileText,
  FileStack, ClipboardList, DollarSign, Wallet, CreditCard, CalendarClock, Bell,
  BadgeCheck, XCircle, Sparkles, Award, TrendingUp, TrendingDown, AlertTriangle,
  ChevronLeft, Info, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Card, Tabs, Badge, Spinner, EmptyState } from '@/shared/components/ui';
import { useAdminStats } from '@/features/admin/hooks/useAdminStats';
import type { AdminStats } from '@/features/admin/types/stats';

/* ──────────────────────────── constants ──────────────────────────── */

const WARNING_MAP: Record<string, string> = {
  'إيرادات الكورسات المؤكدة تحتسب فقط مدفوعات Paymob الناجحة؛ الاشتراكات المجانية أو عبر الأكواد غير محتسبة.': 'adminDashboard.reliabilityWarning1',
  'إيراد اشتراكات المدرسين يحتسب فقط مدفوعات الاشتراك الناجحة؛ الباقة المجانية لا تولّد أي إيراد.': 'adminDashboard.reliabilityWarning2',
  'المدفوعات المعلقة والفاشلة غير محتسبة في الإيرادات وتظهر في مقاييس المعلق/الفاشل فقط.': 'adminDashboard.reliabilityWarning3',
  'المبالغ المستردة والإلغاءات غير محتسبة في الإيرادات.': 'adminDashboard.reliabilityWarning4',
  'إيراد اشتراكات المدرسين محسوب من مدفوعات الاشتراك المؤكدة (القيمة التقديرية غير مستخدمة).': 'adminDashboard.reliabilityWarning5',
  'ترتيب المدرسين حسب الإيراد يعتمد على إيرادات الكورسات المملوكة للمدرس فقط؛ مدفوعات اشتراكات المدرسين تُعد إيراداً للمنصة وليست إيراداً للمدرس.': 'adminDashboard.reliabilityWarning6',
};

const CHART_COLORS = ['#00C9DB', '#7C3AED', '#F59E0B', '#10B981', '#EF4444', '#EC4899'];

/* ──────────────────────────── helpers ────────────────────────────── */

function TrendIndicator({ value, label }: { value?: number; label?: string }) {
  if (value === undefined || value === null) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-success' : 'text-danger'}`}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {up ? '+' : ''}{value.toFixed(1)}%
      {label && <span className="ms-1 font-normal text-text-muted">{label}</span>}
    </span>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`font-cairo text-lg font-bold text-text-primary ${className ?? ''}`}>{children}</h2>;
}

/* ──────────────────────── KPI Hero Card ──────────────────────────── */

function KpiCard({
  title, value, icon: Icon, trend, accent = 'accent', linkTo,
}: {
  title: string;
  value: string;
  icon: typeof Users;
  trend?: number;
  accent?: 'accent' | 'success' | 'warning' | 'danger';
  linkTo?: string;
}) {
  const colorMap: Record<string, string> = {
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  };
  const iconBg = colorMap[accent] ?? colorMap.accent;

  const inner = (
    <Card className="flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${iconBg}`}>
          <Icon size={22} />
        </div>
        {trend !== undefined && <TrendIndicator value={trend} />}
      </div>
      <div>
        <p className="font-cairo text-3xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-4xl">
          {value}
        </p>
        <p className="mt-1 font-cairo text-sm text-text-secondary">{title}</p>
      </div>
    </Card>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="block rounded-card focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
        {inner}
      </Link>
    );
  }
  return inner;
}

/* ──────────────────────── small chart wrappers ──────────────────── */

function RevenueDonut({ course, subscription, currency, locale }: {
  course: number; subscription: number; currency: string; locale: string;
}) {
  const { t } = useTranslation();
  const nf = (n: number) => n.toLocaleString(locale);
  const data = [
    { name: t('adminDashboard.courseRevenue', 'إيراد الكورسات'), value: course },
    { name: t('adminDashboard.subscriptionRevenue', 'إيراد الاشتراكات'), value: subscription },
  ];
  return (
    <Card className="flex flex-col gap-3 p-5">
      <SectionTitle>{t('adminDashboard.revenueBreakdown', 'توزيع الإيرادات')}</SectionTitle>
      <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row">
        <div className="h-48 w-full sm:h-56 sm:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: number) => `${nf(Math.round(val))} ${currency}`}
                contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
              <span className="flex-1 font-cairo text-sm text-text-secondary">{d.name}</span>
              <span className="font-cairo text-sm font-bold text-text-primary">{nf(Math.round(d.value))} {currency}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ContentDonut({ chapters, lessons, materials, quizzes }: {
  chapters: number; lessons: number; materials: number; quizzes: number;
}) {
  const { t } = useTranslation();
  const data = [
    { name: t('adminDashboard.totalChapters', 'الفصول'), value: chapters },
    { name: t('adminDashboard.totalLessons', 'الدروس'), value: lessons },
    { name: t('adminDashboard.totalMaterials', 'الملفات'), value: materials },
    { name: t('adminDashboard.totalQuizzes', 'الاختبارات'), value: quizzes },
  ];
  return (
    <Card className="flex flex-col gap-3 p-5">
      <SectionTitle>{t('adminDashboard.contentDistribution', 'توزيع المحتوى')}</SectionTitle>
      <div className="flex flex-1 flex-col gap-4 sm:flex-row">
        <div className="h-48 w-full sm:h-56 sm:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
              <span className="flex-1 font-cairo text-sm text-text-secondary">{d.name}</span>
              <span className="font-cairo text-sm font-bold text-text-primary">{d.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const { t } = useTranslation();
  const data = [{ name: 'score', value: score, fill: score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444' }];
  return (
    <Card className="flex flex-col items-center gap-3 p-5">
      <SectionTitle>{t('adminDashboard.averageQuizScore', 'متوسط الدرجات')}</SectionTitle>
      <div className="relative h-40 w-40">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            barSize={14}
            startAngle={180}
            endAngle={0}
            data={data}
          >
            <RadialBar
              dataKey="value"
              background={{ fill: '#F3F4F6' }}
              cornerRadius={7}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-cairo text-2xl font-extrabold text-text-primary">{score}%</span>
        </div>
      </div>
    </Card>
  );
}

/* ──────────────────────── reliability tooltip ────────────────────── */

function ReliabilityNotes({ warnings, locale }: { warnings: string[]; locale: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  if (warnings.length === 0) return null;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 font-cairo text-xs font-medium text-warning transition-colors hover:bg-warning/20"
      >
        <AlertTriangle size={14} />
        {t('adminDashboard.reliabilityTitle', 'ملاحظات حول دقة الإيرادات')}
        <Info size={12} />
      </button>
      {open && (
        <div
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          className="absolute bottom-full z-20 mb-2 w-80 rounded-card border border-border bg-surface p-4 shadow-elevated"
        >
          <ul className="list-disc space-y-1 ps-6 font-cairo text-xs text-text-secondary">
            {warnings.map((w, i) => (
              <li key={i}>{t(WARNING_MAP[w] ?? w)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ──────────────────── horizontal bar chart helper ────────────────── */

function HorizontalBarChart<T extends { label: string; value: number }>({
  data, valueFormatter, color,
}: {
  data: T[];
  valueFormatter: (v: number) => string;
  color?: string;
}) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fontSize: 12, fontFamily: 'Cairo' }}
            reversed={isRtl}
          />
          <Tooltip
            formatter={(val: number) => valueFormatter(val)}
            contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
          />
          <Bar dataKey="value" fill={color ?? '#00C9DB'} radius={[0, 6, 6, 0]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ──────────────────── link stat card (compact) ───────────────────── */

function LinkStatCard({
  to, title, value, icon: Icon, accent,
}: {
  to: string; title: string; value: string | number;
  icon: typeof Users; accent?: 'amber' | 'cyan';
}) {
  return (
    <Link to={to} className="block rounded-card focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
      <Card className="flex items-center gap-4 transition-shadow hover:shadow-elevated">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-card ${accent === 'amber' ? 'bg-warning/10' : 'bg-accent/10'}`}>
          <Icon size={20} className={accent === 'amber' ? 'text-warning' : 'text-accent'} />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="font-cairo text-xl font-bold text-text-primary">{value}</span>
          <span className="font-cairo text-xs text-text-secondary">{title}</span>
        </div>
        <ChevronLeft size={16} className="text-text-muted rtl:rotate-180" />
      </Card>
    </Link>
  );
}

/* ──────────────────────── main page ─────────────────────────────── */

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } = useAdminStats();
  const [activeTab, setActiveTab] = useState('users');

  const header = (
    <div>
      <h1 className="font-cairo text-2xl font-bold text-text-primary sm:text-3xl">
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
          <AlertTriangle className="h-12 w-12 text-danger" />
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
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const nf = (n: number) => n.toLocaleString(locale);
  const money = (n: number) => `${nf(Math.round(n))} ${currency}`;

  /* ── Tabs config ── */
  const tabItems = [
    { key: 'users', label: t('adminDashboard.usersSection', 'المستخدمون') },
    { key: 'content', label: t('adminDashboard.contentSection', 'المحتوى') },
    { key: 'learning', label: t('adminDashboard.learningSection', 'التعلّم') },
    { key: 'ai', label: t('adminDashboard.aiSection', 'الذكاء الاصطناعي') },
    { key: 'operations', label: t('adminDashboard.operationsSection', 'العمليات') },
  ];

  return (
    <div className="flex flex-col gap-8" aria-busy={isFetching}>
      {header}

      {/* ─── KPI HERO CARDS ─── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t('adminDashboard.totalConfirmedRevenue', 'إجمالي الإيرادات المؤكدة')}
          value={money(s.finance.totalConfirmedRevenue)}
          icon={DollarSign}
          accent="accent"
          linkTo="/admin/revenue"
        />
        <KpiCard
          title={t('adminDashboard.totalStudents', 'إجمالي الطلاب')}
          value={nf(s.users.totalStudents)}
          icon={GraduationCap}
          accent="info"
        />
        <KpiCard
          title={t('adminDashboard.totalTeachers', 'إجمالي المدرسين')}
          value={nf(s.users.totalTeachers)}
          icon={Users}
          accent="accent"
        />
        <KpiCard
          title={t('adminDashboard.monthlyConfirmedRevenue', 'إيرادات هذا الشهر')}
          value={money(s.finance.monthlyConfirmedRevenue)}
          icon={CalendarClock}
          accent="success"
        />
      </section>

      {/* ─── CHARTS ROW ─── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RevenueDonut
          course={s.finance.confirmedCourseRevenue}
          subscription={s.finance.confirmedTeacherSubscriptionRevenue}
          currency={currency}
          locale={locale}
        />
        <ContentDonut
          chapters={s.content.totalChapters}
          lessons={s.content.totalLessons}
          materials={s.content.totalMaterials}
          quizzes={s.content.totalQuizzes}
        />
        <ScoreGauge score={s.learning.averageQuizScore} />
      </section>

      {/* ─── TABS ─── */}
      <section>
        <Tabs tabs={tabItems} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="pt-5">
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <LinkStatCard
                  to="/admin/students?filter=without_active_teacher"
                  icon={UserX}
                  accent="amber"
                  title={t('adminDashboard.studentsWithoutTeacher', 'طلاب بدون مدرس نشط')}
                  value={nf(s.users.studentsWithoutTeacher)}
                />
                <LinkStatCard
                  to="/admin/students?filter=without_enrollment"
                  icon={UserMinus}
                  accent="amber"
                  title={t('adminDashboard.studentsWithoutAnyEnrollment', 'طلاب بدون أي اشتراك')}
                  value={nf(s.users.studentsWithoutAnyEnrollment)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-success/10">
                    <UserCheck size={18} className="text-success" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.users.activeTeachers)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.activeTeachers', 'المدرسون النشطون')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-success/10">
                    <UserCheck size={18} className="text-success" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.users.activeStudents)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.activeStudents', 'الطلاب النشطون')}</p>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Content Tab */}
          {activeTab === 'content' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent/10">
                    <Layers size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.content.totalStages)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.totalStages', 'المراحل')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent/10">
                    <BookOpen size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.content.totalChapters)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.totalChapters', 'الفصول')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent/10">
                    <FileText size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.content.totalLessons)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.totalLessons', 'الدروس')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent/10">
                    <FileStack size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.content.totalMaterials)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.totalMaterials', 'الملفات')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent/10">
                    <ClipboardList size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.content.totalQuizzes)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.totalQuizzes', 'الاختبارات')}</p>
                  </div>
                </Card>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">
                  {t('adminDashboard.publishedQuizzes', 'اختبارات منشورة')}: {nf(s.content.publishedQuizzes)}
                </Badge>
                <Badge variant="warning">
                  {t('adminDashboard.draftQuizzes', 'اختبارات مسودة')}: {nf(s.content.draftQuizzes)}
                </Badge>
              </div>
            </div>
          )}

          {/* Learning Tab */}
          {activeTab === 'learning' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent/10">
                    <BookOpen size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.learning.totalEnrollments)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.totalEnrollments', 'إجمالي الاشتراكات')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-success/10">
                    <UserCheck size={18} className="text-success" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.learning.activeEnrollments)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.activeEnrollments', 'اشتراكات نشطة')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-warning/10">
                    <CalendarClock size={18} className="text-warning" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.learning.pendingEnrollments)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.pendingEnrollments', 'مدفوعات معلقة')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent/10">
                    <ClipboardList size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.learning.quizAttempts)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.quizAttempts', 'محاولات الاختبارات')}</p>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* AI Usage Tab */}
          {activeTab === 'ai' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-info/10">
                    <Sparkles size={18} className="text-info" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.ai.quizGenerations)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.quizGenerations', 'توليد اختبارات')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-info/10">
                    <Sparkles size={18} className="text-info" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.ai.essayGrading)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.essayGrading', 'تصحيح مقالات')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent/10">
                    <TrendingUp size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.ai.totalAiEvents)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.totalAiEvents', 'إجمالي العمليات')}</p>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Operations Tab */}
          {activeTab === 'operations' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <LinkStatCard
                  to="/admin/teacher-requests"
                  icon={Bell}
                  accent="amber"
                  title={t('adminDashboard.pendingTeacherRequests', 'طلبات تسجيل معلقة')}
                  value={nf(s.operations.pendingTeacherRequests)}
                />
                <LinkStatCard
                  to="/admin/subscriptions"
                  icon={CreditCard}
                  accent="amber"
                  title={t('adminDashboard.pendingTeacherSubscriptionPayments', 'مدفوعات باقات معلقة')}
                  value={nf(s.operations.pendingTeacherSubscriptionPayments)}
                />
                <LinkStatCard
                  to="/admin/subscriptions"
                  icon={XCircle}
                  accent="amber"
                  title={t('adminDashboard.failedTeacherSubscriptionPayments', 'مدفوعات فاشلة')}
                  value={nf(s.operations.failedTeacherSubscriptionPayments)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-success/10">
                    <BadgeCheck size={18} className="text-success" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.operations.activeTeacherSubscriptions)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.activeTeacherSubscriptions', 'اشتراكات نشطة')}</p>
                  </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-warning/10">
                    <ClipboardList size={18} className="text-warning" />
                  </div>
                  <div>
                    <p className="font-cairo text-xl font-bold text-text-primary">{nf(s.operations.pendingTeacherSubscriptionRequests)}</p>
                    <p className="font-cairo text-xs text-text-secondary">{t('adminDashboard.pendingTeacherSubscriptionRequests', 'طلبات اشتراك معلقة')}</p>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── TOP TEACHERS ─── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* By Revenue */}
        <Card className="flex flex-col gap-3 p-5">
          <SectionTitle>{t('adminDashboard.topByRevenue', 'أكثر المدرسين من حيث الإيرادات')}</SectionTitle>
          {s.topTeachers.byRevenue.length === 0 ? (
            <EmptyState icon={Award} title={t('adminDashboard.noTopTeachers', 'لا توجد بيانات بعد')} />
          ) : (
            <>
              <HorizontalBarChart
                data={s.topTeachers.byRevenue.map((r) => ({ label: r.fullName, value: r.revenue }))}
                valueFormatter={(v) => money(v)}
                color="#00C9DB"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-secondary">
                      <th className="py-1.5 text-start font-medium">{t('adminDashboard.teacher', 'المدرس')}</th>
                      <th className="py-1.5 text-start font-medium">{t('adminDashboard.revenue', 'الإيراد')}</th>
                      <th className="py-1.5 text-end font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.topTeachers.byRevenue.map((r) => (
                      <tr key={r.teacherId} className="border-b border-border/50 last:border-0">
                        <td className="py-2 font-cairo text-text-primary">{r.fullName}</td>
                        <td className="py-2 font-cairo font-semibold text-text-primary">{money(r.revenue)}</td>
                        <td className="py-2 text-end">
                          <Link
                            to={`/admin/teachers/${r.teacherId}`}
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
            </>
          )}
        </Card>

        {/* By Students */}
        <Card className="flex flex-col gap-3 p-5">
          <SectionTitle>{t('adminDashboard.topByStudents', 'أكثر المدرسين من حيث عدد الطلاب')}</SectionTitle>
          {s.topTeachers.byStudents.length === 0 ? (
            <EmptyState icon={Award} title={t('adminDashboard.noTopTeachers', 'لا توجد بيانات بعد')} />
          ) : (
            <>
              <HorizontalBarChart
                data={s.topTeachers.byStudents.map((r) => ({ label: r.fullName, value: r.studentCount }))}
                valueFormatter={(v) => nf(v)}
                color="#7C3AED"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-secondary">
                      <th className="py-1.5 text-start font-medium">{t('adminDashboard.teacher', 'المدرس')}</th>
                      <th className="py-1.5 text-start font-medium">{t('adminDashboard.students', 'الطلاب')}</th>
                      <th className="py-1.5 text-end font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.topTeachers.byStudents.map((r) => (
                      <tr key={r.teacherId} className="border-b border-border/50 last:border-0">
                        <td className="py-2 font-cairo text-text-primary">{r.fullName}</td>
                        <td className="py-2 font-cairo font-semibold text-text-primary">{nf(r.studentCount)}</td>
                        <td className="py-2 text-end">
                          <Link
                            to={`/admin/teachers/${r.teacherId}`}
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
            </>
          )}
        </Card>
      </section>

      {/* ─── Reliability Notes (collapsed) ─── */}
      <ReliabilityNotes warnings={s.finance.reliabilityWarnings} locale={i18n.language} />
    </div>
  );
}
