import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '@/shared/components/ui';
import { StudentHero } from '@/features/student/components/StudentHero';
import { AllContentTree } from '@/features/student/components/AllContentTree';
import { MyCoursesTab } from '@/features/student/components/MyCoursesTab';

type TabKey = 'all' | 'courses';

/**
 * Student landing page (the sidebar "Dashboard" entry). A real-data welcome
 * strip sits above two content tabs backed by the student APIs:
 *   - All Content -> stages/chapters/lessons accordion (AllContentTree)
 *   - My Courses  -> enrolled course cards + an "explore more" section
 */
export function StudentDashboardPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const tabs = [
    { key: 'courses', label: t('student:content.tabs.myCourses') },
    { key: 'all', label: t('student:content.tabs.allContent') },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <StudentHero />

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(key) => setActiveTab(key as TabKey)} />

      {activeTab === 'all' ? (
        <AllContentTree />
      ) : (
        <MyCoursesTab active={activeTab === 'courses'} showExplore />
      )}
    </div>
  );
}
