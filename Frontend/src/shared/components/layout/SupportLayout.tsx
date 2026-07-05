import { Outlet } from 'react-router-dom';
import { Ticket, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from './AppHeader';
import { Sidebar, type SidebarItem } from './Sidebar';

export function SupportLayout() {
  const { t } = useTranslation();

  const items: SidebarItem[] = [
    { label: t('nav.promoCodes'), icon: Ticket, path: '/support/promo-codes' },
    { label: t('nav.studentLookup'), icon: Search, path: '/support/students' },
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
