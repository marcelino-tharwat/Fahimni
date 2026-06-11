import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Lock, ChevronLeft } from 'lucide-react';
import { Badge, Button, Card } from '@/shared/components/ui';
import { mockChapters, mockStages } from '@/shared/mocks/content';

export function AllContentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('student:allContent')}</h1>

      {mockStages.map((stage) => (
        <section key={stage.id} className="flex flex-col gap-4">
          <h2 className="font-cairo text-lg font-semibold text-text-secondary">{stage.name}</h2>

          <div className="flex flex-col gap-3">
            {mockChapters
              .filter((chapter) => chapter.stageId === stage.id)
              .map((chapter) => (
                <Card key={chapter.id} padding="md" className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-cairo text-base font-semibold text-text-primary">
                      {chapter.name}
                    </span>
                    {chapter.description && (
                      <span className="font-cairo text-sm text-text-secondary">
                        {chapter.description}
                      </span>
                    )}
                  </div>

                  {chapter.isUnlocked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/student/lesson')}
                      aria-label={chapter.name}
                    >
                      <ChevronLeft size={18} className="rtl:rotate-180" />
                    </Button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="info">{t('student:price', { price: chapter.price })}</Badge>
                      <Button size="sm" onClick={() => navigate('/student/payment')}>
                        <Lock size={16} />
                        {t('student:subscribe')}
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
