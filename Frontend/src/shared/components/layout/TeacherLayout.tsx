import { Outlet } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Brain, ClipboardList, Users, User, Ticket, PenSquare, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from './AppHeader';
import { Sidebar, type SidebarItem } from './Sidebar';
import { TeacherPlanBadge } from '@/features/teacher/components/TeacherPlanBadge';

export function TeacherLayout() {
  const { t } = useTranslation();

  const items: SidebarItem[] = [
    { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/teacher/dashboard' },
    { label: t('nav.contentManagement'), icon: FolderOpen, path: '/teacher/content' },
    { label: t('nav.quizzes'), icon: ClipboardList, path: '/teacher/quizzes', end: true },
    { label: t('nav.essayGrading'), icon: PenSquare, path: '/teacher/essay-grading', end: true },
    { label: t('nav.quizGenerator'), icon: Brain, path: '/teacher/quizzes/generator' },
    { label: t('nav.students'), icon: Users, path: '/teacher/students' },
    { label: t('nav.promoCodes'), icon: Ticket, path: '/teacher/promo-codes' },
    { label: t('nav.plans'), icon: CreditCard, path: '/teacher/plans' },
    { label: t('nav.profile'), icon: User, path: '/teacher/profile' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar items={items} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0">
          <AppHeader />
        </header>
        <main className="flex-1 overflow-y-auto px-3 py-4 md:px-4 md:py-6 lg:px-6 lg:py-8">
          <div className="mb-4">
            <TeacherPlanBadge />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
