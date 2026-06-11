import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Progress, Tabs } from '@/shared/components/ui';
import { mockChapters, mockLessons, mockStages } from '@/shared/mocks/content';

type DashboardTab = 'courses' | 'content';

function chapterProgress(chapterId: string): number {
  const lessons = mockLessons.filter((lesson) => lesson.chapterId === chapterId);
  if (lessons.length === 0) return 0;
  const total = lessons.reduce((sum, lesson) => sum + (lesson.progress?.percentWatched ?? 0), 0);
  return Math.round(total / lessons.length);
}

export function StudentDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>('courses');

  const enrolledChapters = mockChapters.filter((chapter) => chapter.isUnlocked);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('student:dashboard')}</h1>

      <Tabs
        tabs={[
          { key: 'courses', label: t('student:myCourses') },
          { key: 'content', label: t('student:allContent') },
        ]}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as DashboardTab)}
      />

      {activeTab === 'courses' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrolledChapters.map((chapter) => (
            <Card key={chapter.id} padding="lg" className="flex flex-col gap-4">
              <h3 className="font-cairo text-base font-semibold text-text-primary">{chapter.name}</h3>
              <Progress value={chapterProgress(chapter.id)} showLabel />
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="font-cairo text-lg font-semibold text-text-secondary">
            {mockStages[0]?.name}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockChapters.map((chapter) => (
              <Card key={chapter.id} padding="lg" className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-cairo text-base font-semibold text-text-primary">
                    {chapter.name}
                  </h3>
                  <Badge variant={chapter.isUnlocked ? 'success' : 'default'}>
                    {chapter.isUnlocked ? t('student:unlocked') : t('student:locked')}
                  </Badge>
                </div>
                {chapter.isUnlocked ? (
                  <Progress value={chapterProgress(chapter.id)} showLabel />
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="info">{t('student:price', { price: chapter.price })}</Badge>
                    <Button size="sm" onClick={() => navigate('/student/payment')}>
                      {t('student:subscribe')}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
