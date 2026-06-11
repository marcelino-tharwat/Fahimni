import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Button, Card, Progress } from '@/shared/components/ui';
import { mockChapters, mockLessons } from '@/shared/mocks/content';

function chapterLessonCount(chapterId: string): number {
  return mockLessons.filter((lesson) => lesson.chapterId === chapterId).length;
}

function chapterProgress(chapterId: string): number {
  const lessons = mockLessons.filter((lesson) => lesson.chapterId === chapterId);
  if (lessons.length === 0) return 0;
  const total = lessons.reduce((sum, lesson) => sum + (lesson.progress?.percentWatched ?? 0), 0);
  return Math.round(total / lessons.length);
}

export function MyCoursesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const unlockedChapters = mockChapters.filter((chapter) => chapter.isUnlocked);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('student:myCourses')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {unlockedChapters.map((chapter) => (
          <Card key={chapter.id} padding="lg" className="flex flex-col gap-4">
            <h3 className="font-cairo text-base font-semibold text-text-primary">{chapter.name}</h3>
            <div className="flex items-center gap-2 font-cairo text-sm text-text-secondary">
              <BookOpen size={16} />
              <span>
                {chapterLessonCount(chapter.id)} {t('teacher:contentManager.lessons')}
              </span>
            </div>
            <Progress value={chapterProgress(chapter.id)} showLabel />
            <Button variant="outline" size="sm" onClick={() => navigate('/student/lesson')}>
              {t('student:watchLesson')}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
