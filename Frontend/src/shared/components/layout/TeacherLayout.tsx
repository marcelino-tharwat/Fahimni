import { Outlet } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Brain, Users, Palette, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Topbar } from './Topbar';
import { Sidebar, type SidebarItem } from './Sidebar';

export function TeacherLayout() {
  const { t } = useTranslation();

  const items: SidebarItem[] = [
    { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/teacher/dashboard' },
    { label: t('nav.content'), icon: FolderOpen, path: '/teacher/content' },
    { label: t('nav.quizzes'), icon: Brain, path: '/teacher/quizzes/generator' },
    { label: t('nav.students'), icon: Users, path: '/teacher/students' },
    { label: t('nav.branding'), icon: Palette, path: '/teacher/branding' },
    { label: t('nav.settings'), icon: Settings, path: '/teacher/settings' },
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
