import { Outlet } from 'react-router-dom';
import { Ticket, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Topbar } from './Topbar';
import { Sidebar, type SidebarItem } from './Sidebar';

export function SupportLayout() {
  const { t } = useTranslation();

  const items: SidebarItem[] = [
    { label: t('nav.promoCodes'), icon: Ticket, path: '/support/promo-codes' },
    { label: t('nav.studentLookup'), icon: Search, path: '/support/students' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar items={items} />
        <main className="flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
