import { Outlet } from 'react-router-dom';
import {
  GraduationCap, LayoutDashboard, Ticket,
  Users, ClipboardCheck, CreditCard, Wallet, TrendingUp, Receipt,
  ScrollText, Banknote,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from './AppHeader';
import { Sidebar, type SidebarItem } from './Sidebar';

export function AdminPlansLayout() {
  const { t } = useTranslation();

  const items: SidebarItem[] = [
    { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: t('nav.users'), icon: Users, path: '/admin/users' },
    { label: t('nav.teachers'), icon: GraduationCap, path: '/admin/teachers' },
    { label: t('nav.students'), icon: Users, path: '/admin/students' },
    { label: t('nav.teacherRequests'), icon: ClipboardCheck, path: '/admin/teacher-requests' },
    { label: t('nav.promoCodes'), icon: Ticket, path: '/admin/promo-codes' },
    { label: t('nav.plans'), icon: CreditCard, path: '/admin/plans' },
    { label: t('nav.subscriptions'), icon: Wallet, path: '/admin/subscriptions' },
    { label: t('nav.teacherWithdrawals'), icon: Banknote, path: '/admin/teacher-withdrawals' },
    { label: t('nav.revenue'), icon: TrendingUp, path: '/admin/revenue' },
    { label: t('nav.payments'), icon: Receipt, path: '/admin/payments' },
    { label: t('nav.auditLogs'), icon: ScrollText, path: '/admin/audit-logs' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar items={items} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0">
          <AppHeader />
        </header>
        <main className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
