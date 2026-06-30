import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Bot, User, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Topbar } from './Topbar';
import { Sidebar, type SidebarItem } from './Sidebar';
import { cn } from '@/shared/lib/utils/cn';

export function StudentLayout() {
  const { t } = useTranslation();

  const items: SidebarItem[] = [
    { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/student/dashboard' },
    { label: t('nav.quizzes'), icon: ClipboardList, path: '/student/quizzes' },
    { label: t('nav.aiTutor'), icon: Bot, path: '/student/ai-tutor' },
    { label: t('nav.profile'), icon: User, path: '/student/profile' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar items={items} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Student mobile nav is the bottom tab bar, so no hamburger here. */}
        <header className="shrink-0">
          <Topbar showMenu={false} />
        </header>
        <main className="flex-1 overflow-y-auto p-3 pb-20 md:p-4 md:pb-6 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-surface md:hidden">
        {items.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2 font-cairo text-xs transition-colors',
                isActive ? 'text-accent' : 'text-text-secondary',
              )
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
