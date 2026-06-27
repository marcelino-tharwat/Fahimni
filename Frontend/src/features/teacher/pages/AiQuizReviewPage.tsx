import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button, Card } from '@/shared/components/ui';
import { QuizStepper } from '@/features/teacher/components/quiz-generator';

export function AiQuizReviewPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-cairo text-2xl font-bold text-text-primary">
          {t('teacher:quizGenerator.title')}
        </h1>
        <p className="font-cairo text-sm text-text-secondary">
          {t('teacher:quizGenerator.subtitle')}
        </p>
      </div>

      <QuizStepper activeStep={1} />

      <Card padding="lg" className="flex flex-col items-center gap-4 py-12">
        <Sparkles size={48} className="text-accent" />
        <h2 className="font-cairo text-xl font-bold text-text-primary">
          {t('teacher:quizGenerator.quizCreated')}
        </h2>
        <p className="font-cairo text-sm text-text-secondary">
          {t('teacher:quizGenerator.quizId')} {quizId}
        </p>
        <p className="font-cairo text-sm text-text-secondary">
          {t('teacher:quizGenerator.reviewUnderDevelopment')}
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/teacher/quizzes/generator')}
          >
            <ArrowLeft size={18} />
            {t('teacher:quizGenerator.backToSettings')}
          </Button>
          <Button onClick={() => navigate('/teacher/dashboard')}>
            {t('teacher:quizGenerator.dashboard')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
