import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Rocket } from 'lucide-react';
import { Button, Card } from '@/shared/components/ui';
import { QuizStepper } from '@/features/teacher/components/quiz-generator';

/**
 * Step 3 (publish) placeholder. The full publish UI is STORY-56; this page only
 * exists so the Step 2 "Continue to Step 3" action navigates to a real route with
 * the real draft quiz id rather than a dead link. It performs no publishing.
 */
export function AiQuizPublishPage() {
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

      <QuizStepper activeStep={2} />

      <Card padding="lg" className="flex flex-col items-center gap-4 py-12 text-center">
        <Rocket size={40} className="text-accent" />
        <h2 className="font-cairo text-xl font-bold text-text-primary">
          {t('teacher:quizGenerator.review.step3.title')}
        </h2>
        <p className="font-cairo text-sm text-text-secondary">
          {t('teacher:quizGenerator.review.step3.comingSoon')}
        </p>
        <Button
          variant="outline"
          onClick={() => navigate(`/teacher/quizzes/generator/review/${quizId}`)}
        >
          <ArrowLeft size={18} />
          {t('teacher:quizGenerator.review.step3.backToReview')}
        </Button>
      </Card>
    </div>
  );
}
