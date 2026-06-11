import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, BookOpen, Brain, Plus, type LucideIcon } from 'lucide-react';
import { Button, StatCard } from '@/shared/components/ui';
import { mockAnalytics } from '@/shared/mocks/analytics';

interface Stat {
  labelKey: string;
  value: number;
  icon: LucideIcon;
}

export function TeacherDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const stats: Stat[] = [
    { labelKey: 'teacher:stats.totalStudents', value: mockAnalytics.totalStudents, icon: Users },
    { labelKey: 'teacher:stats.activeThisMonth', value: mockAnalytics.activeThisMonth, icon: UserCheck },
    { labelKey: 'teacher:stats.publishedChapters', value: mockAnalytics.publishedChapters, icon: BookOpen },
    { labelKey: 'teacher:stats.quizzesCreated', value: mockAnalytics.quizzesCreated, icon: Brain },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('teacher:dashboard')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {stats.map((stat) => (
          <StatCard key={stat.labelKey} title={t(stat.labelKey)} value={stat.value} icon={stat.icon} />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/teacher/content')}>
          <Plus size={18} />
          {t('teacher:quickActions.addLesson')}
        </Button>
        <Button onClick={() => navigate('/teacher/quizzes/generator')}>
          <Plus size={18} />
          {t('teacher:quickActions.generateQuiz')}
        </Button>
      </div>
    </div>
  );
}
