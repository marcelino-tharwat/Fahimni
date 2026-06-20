import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '@/shared/components/ui';
import { AllContentTree } from '@/features/student/components/AllContentTree';
import { MyCoursesTab } from '@/features/student/components/MyCoursesTab';

type TabKey = 'all' | 'courses';

export function AllContentPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const tabs = [
    { key: 'courses', label: t('student:content.tabs.myCourses') },
    { key: 'all', label: t('student:content.tabs.allContent') },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header>
        <h1 className="font-cairo text-2xl font-bold text-navy-900">
          {t('student:content.title')}
        </h1>
        <p className="mt-1 font-cairo text-sm text-gray-500">{t('student:content.subtitle')}</p>
      </header>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(key) => setActiveTab(key as TabKey)} />

      {activeTab === 'all' ? <AllContentTree /> : <MyCoursesTab active={activeTab === 'courses'} />}
    </div>
  );
}
