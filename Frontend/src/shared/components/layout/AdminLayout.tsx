import { Outlet } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Topbar } from './Topbar';
import { Sidebar, type SidebarItem } from './Sidebar';

export function AdminLayout() {
  const { t } = useTranslation();

  const items: SidebarItem[] = [
    { label: t('nav.tenants'), icon: Building2, path: '/admin/tenants' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar items={items} />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
