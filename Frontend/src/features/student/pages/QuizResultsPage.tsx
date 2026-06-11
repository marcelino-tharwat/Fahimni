import { useTranslation } from 'react-i18next';
import { Badge, Card } from '@/shared/components/ui';
import { mockQuiz, mockQuizAttempt } from '@/shared/mocks/quizzes';

const toArabicDigits = (value: number): string => value.toLocaleString('ar-EG');

export function QuizResultsPage() {
  const { t } = useTranslation();

  const total = mockQuiz.questions.length;
  const score = mockQuizAttempt.score ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('student:quizResults')}</h1>

      {/* Score card */}
      <Card padding="lg" className="flex flex-col items-center gap-2 text-center">
        <span className="font-cairo text-sm text-text-secondary">{mockQuiz.title}</span>
        <div className="flex items-baseline gap-2 font-cairo">
          <span className="text-5xl font-extrabold text-accent">{toArabicDigits(score)}</span>
          <span className="text-2xl font-semibold text-text-secondary">من</span>
          <span className="text-5xl font-extrabold text-text-primary">{toArabicDigits(total)}</span>
        </div>
      </Card>

      {/* Per-question breakdown */}
      <div className="flex flex-col gap-4">
        {mockQuiz.questions.map((question, index) => {
          const isCorrect = mockQuizAttempt.answers[question.id] === question.correctAnswer;
          return (
            <Card key={question.id} padding="lg" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-cairo text-base font-semibold text-text-primary">
                  {index + 1}. {question.question}
                </h3>
                <Badge variant={isCorrect ? 'success' : 'danger'}>
                  {isCorrect ? 'إجابة صحيحة' : 'إجابة خاطئة'}
                </Badge>
              </div>
              {question.explanation && (
                <p className="rounded-input bg-background p-3 font-cairo text-sm text-text-secondary">
                  {question.explanation}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
