import { useTranslation } from 'react-i18next';
import { Badge, Card } from '@/shared/components/ui';
import type { QuizQuestion } from '@/shared/types';
import { mockQuiz, mockQuizAttempt, mockQuizResults } from '@/shared/mocks/quizzes';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';

export function QuizResultsPage() {
  const { t } = useTranslation();

  const total = mockQuiz.questions.length;
  const score = mockQuizAttempt.score ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-page py-6">
      {/* Score card */}
      <Card padding="lg" className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-cairo text-xl font-bold text-text-primary">
          {t('quiz:yourScore')}
        </h2>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-extrabold text-accent">{toLocalNum(score)}</span>
          <span className="text-2xl font-semibold text-text-secondary">{t('common:of', { defaultValue: 'من' })}</span>
          <span className="text-5xl font-extrabold text-text-primary">{toLocalNum(total)}</span>
        </div>
      </Card>

      {/* Per-question breakdown */}
      <div className="flex flex-col gap-4">
        {mockQuiz.questions.map((question: QuizQuestion, index: number) => {
          const result = mockQuizResults[question.id];
          const studentAnswer = mockQuizAttempt.answers[question.id];
          const isCorrect = result ? String(studentAnswer) === result.correctAnswer : false;

          return (
            <Card key={question.id} padding="lg" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-cairo text-base font-semibold text-text-primary">
                  {index + 1}. {question.text}
                </h3>
                <Badge variant={isCorrect ? 'success' : 'danger'}>
                  {isCorrect ? t('common:correct', { defaultValue: 'إجابة صحيحة' }) : t('common:incorrect', { defaultValue: 'إجابة خاطئة' })}
                </Badge>
              </div>
              {result?.explanation && (
                <p className="rounded-input bg-background p-3 font-cairo text-sm text-text-secondary">
                  {result.explanation}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
