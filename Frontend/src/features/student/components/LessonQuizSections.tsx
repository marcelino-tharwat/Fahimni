import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card } from '@/shared/components/ui';
import {
  resolveQuizStudentAction,
  type QuizStudentAction,
} from '@/features/student/lib/quizNavigation';
import type { StudentQuizVisibility } from '@/features/student/types/studentQuiz';

function toQuizItemMeta(quiz: StudentQuizVisibility) {
  return {
    id: quiz.id,
    title: quiz.title,
    questionCount: quiz.questionCount,
    points: quiz.totalPoints,
    durationMinutes: quiz.durationMinutes,
    difficulty: 'medium' as const,
    status: quiz.displayStatus,
    attemptId: quiz.attemptId,
    attemptStatus:
      quiz.studentAttemptStatus === 'NOT_STARTED' ? null : quiz.studentAttemptStatus,
    score: quiz.score,
    retakeAllowed: quiz.retakeAllowed,
  };
}

function QuizActionCard({
  quiz,
  variant,
  onNavigate,
}: {
  quiz: StudentQuizVisibility;
  variant: 'optional' | 'required';
  onNavigate: (quizId: string, action: QuizStudentAction, attemptId: string | null) => void;
}) {
  const { t } = useTranslation();
  const meta = toQuizItemMeta(quiz);
  const action = resolveQuizStudentAction(meta);

  const subtitle =
    action === 'viewResult'
      ? t('student:lesson.quizAlreadyTaken')
      : action === 'resume'
        ? t('student:lesson.quizInProgress')
        : (quiz.description ?? t('student:lesson.quizPrompt'));

  return (
    <Card
      padding="md"
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <span className="font-cairo text-base font-semibold text-navy-900">{quiz.title}</span>
        <span className="font-cairo text-sm text-gray-500">{subtitle}</span>
        {variant === 'required' && (
          <span className="font-cairo text-xs text-warning-600">
            {t('student:lesson.requiredQuizHint')}
          </span>
        )}
        {variant === 'optional' && (
          <span className="font-cairo text-xs text-gray-500">
            {t('student:lesson.optionalQuizHint')}
          </span>
        )}
        {meta.status === 'passed' || meta.status === 'failed' ? (
          <Badge variant={meta.status === 'passed' ? 'success' : 'danger'}>
            {t(`quiz:quiz.status.${meta.status}`, { score: meta.score ?? 0 })}
          </Badge>
        ) : null}
      </div>
      <Button
        variant={action === 'viewResult' ? 'outline' : 'primary'}
        onClick={() => onNavigate(quiz.id, action, quiz.attemptId)}
      >
        {action === 'viewResult'
          ? t('quiz:quiz.action.viewResult')
          : action === 'resume'
            ? t('quiz:quiz.action.continue')
            : t('student:takeQuiz')}
      </Button>
    </Card>
  );
}

export function LessonQuizSections({
  available,
  required,
}: {
  available: StudentQuizVisibility[];
  required: StudentQuizVisibility | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleNavigate = (
    quizId: string,
    action: QuizStudentAction,
    attemptId: string | null,
  ) => {
    if (action === 'viewResult' && attemptId) {
      navigate(`/student/quizzes/${quizId}/results/${attemptId}`);
      return;
    }
    navigate(`/student/quizzes/${quizId}`);
  };

  if (available.length === 0 && !required) return null;

  return (
    <div className="flex flex-col gap-6">
      {available.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-cairo text-base font-semibold text-navy-900">
            {t('student:lesson.lessonQuizzesTitle')}
          </h2>
          <div className="flex flex-col gap-3">
            {available.map((quiz) => (
              <QuizActionCard
                key={quiz.id}
                quiz={quiz}
                variant="optional"
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        </section>
      )}

      {required && (
        <section className="flex flex-col gap-3">
          <h2 className="font-cairo text-base font-semibold text-navy-900">
            {t('student:lesson.requiredQuizTitle')}
          </h2>
          <QuizActionCard
            quiz={required}
            variant="required"
            onNavigate={handleNavigate}
          />
        </section>
      )}
    </div>
  );
}
