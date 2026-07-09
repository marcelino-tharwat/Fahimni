import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, Ticket, GraduationCap, Users, ClipboardCheck, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from './AppHeader';
import { Sidebar, type SidebarItem } from './Sidebar';

export function AdminLayout() {
  const { t } = useTranslation();

  // Only routes with an implemented page are linked here. Subscriptions / Revenue
  // are added by their own feature tasks (no route yet, so linking them would 404).
  const items: SidebarItem[] = [
    { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: t('nav.teachers'), icon: GraduationCap, path: '/admin/teachers' },
    { label: t('nav.students'), icon: Users, path: '/admin/students' },
    { label: t('nav.teacherRequests'), icon: ClipboardCheck, path: '/admin/teacher-requests' },
    { label: t('nav.tenants'), icon: Building2, path: '/admin/tenants' },
    { label: t('nav.promoCodes'), icon: Ticket, path: '/admin/promo-codes' },
    { label: t('nav.plans'), icon: CreditCard, path: '/admin/plans' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar items={items} />
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 px-3 py-4 md:px-4 md:py-6 lg:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
