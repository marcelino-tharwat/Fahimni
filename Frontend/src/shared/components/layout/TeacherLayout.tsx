import { Outlet } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Brain, Users, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Topbar } from './Topbar';
import { Sidebar, type SidebarItem } from './Sidebar';

export function TeacherLayout() {
  const { t } = useTranslation();

  const items: SidebarItem[] = [
    { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/teacher/dashboard' },
    { label: t('nav.contentManagement'), icon: FolderOpen, path: '/teacher/content' },
    { label: t('nav.quizGenerator'), icon: Brain, path: '/teacher/quizzes/generator' },
    { label: t('nav.students'), icon: Users, path: '/teacher/students' },
    { label: t('nav.settings'), icon: Settings, path: '/teacher/settings' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar items={items} />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-3 py-4 md:px-4 md:py-6 lg:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
