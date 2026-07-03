import { useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft as ChevronLeftIcon,
  CheckCircle, XCircle, Clock,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import { Avatar } from '@/shared/components/ui/Avatar';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useQuizResults } from '@/features/teacher/hooks/useQuizResults';
import { getGradeBadge, toLocalNum } from '@/features/teacher/lib/quizResultsUtils';
import { cn } from '@/shared/lib/utils/cn';
import type { StudentResultRow, StudentResultQuestion } from '@/features/teacher/api/quizGeneration';

function ScoreRingSmall({ percentage, pass }: { percentage: number; pass: boolean }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const size = 64;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = pass ? 'text-success-500' : 'text-danger-500';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-gray-200" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          stroke="currentColor"
          className={cn(color, 'transition-[stroke-dashoffset] duration-1000')}
        />
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center text-lg font-extrabold', color)}>
        {toLocalNum(clamped)}%
      </span>
    </div>
  );
}

function QuestionTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const labelKey = type === 'MCQ' ? 'mcq' : type === 'TRUE_FALSE' ? 'tf' : 'essay';
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {t(`teacher:teacherQuizResults.studentBreakdown.types.${labelKey}`)}
    </span>
  );
}

function AnswerCell({ question, isPassed }: { question: StudentResultQuestion; isPassed: boolean }) {
  const { t } = useTranslation();
  const isEssay = question.type === 'ESSAY';
  const isPending = question.result === 'pending';

  if (isEssay && isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-600">
        <Clock size={12} />
        {t('teacher:teacherQuizResults.studentBreakdown.pendingGrade')}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className={cn('flex items-start gap-1.5', isPassed ? 'text-success-500' : 'text-danger-500')}>
        <span className="text-sm">{question.answer || '—'}</span>
        {isPassed ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
      </div>
      {!isPassed && question.correctAnswer && (
        <span className="text-xs text-success-500">
          {t('teacher:teacherQuizResults.studentBreakdown.correctPrefix')} {question.correctAnswer}
        </span>
      )}
      {isEssay && (
        <div className="mt-1 max-h-[80px] overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-navy-900">
          {question.answer || '—'}
        </div>
      )}
    </div>
  );
}

function ResultIcon({ result, isPending }: { result: string; isPending: boolean }) {
  if (isPending) return <Clock size={16} className="text-warning-500" />;
  if (result === 'correct' || result === 'graded') return <CheckCircle size={16} className="text-success-500" />;
  return <XCircle size={16} className="text-danger-500" />;
}

export function StudentQuestionBreakdownPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { quizId = '', studentId = '' } = useParams<{ quizId: string; studentId: string }>();

  const { data: resultsData, isLoading, isError, refetch } = useQuizResults(quizId);

  const student = useMemo<StudentResultRow | undefined>(() => {
    return resultsData?.results.find((r) => r.studentId === studentId);
  }, [resultsData, studentId]);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-[400px] rounded-card" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col items-center justify-center gap-3 px-4 py-20">
        <AlertCircle size={48} className="text-gray-400" />
        <p className="text-sm text-gray-600">{t('teacher:essayGrading.loadError')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-btn border border-gray-300 px-5 py-2 text-sm text-gray-600"
        >
          {t('teacher:essayGrading.retry')}
        </button>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col items-center justify-center gap-3 px-4 py-20">
        <AlertCircle size={48} className="text-gray-400" />
        <p className="text-sm text-gray-600">{t('teacher:essayGrading.loadError')}</p>
      </div>
    );
  }

  const isPassed = student.percentage >= 50;
  const badge = getGradeBadge(student.percentage);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link to="/teacher/quizzes" className="text-cyan-500 transition-colors hover:text-cyan-600">
          {t('teacher:teacherQuizResults.breadcrumb.quizzes')}
        </Link>
        <ChevronLeftIcon size={14} className="rtl:rotate-180 text-gray-400" />
        <span className="font-semibold text-navy-900">{student.studentName}</span>
      </nav>

      {/* Student header card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-gray-300 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3.5">
          <Avatar name={student.studentName} size="md" />
          <div>
            <h1 className="text-lg font-bold text-navy-900">{student.studentName}</h1>
            <span dir="ltr" className="text-sm text-gray-500">{student.studentMobile ? toLocalNum(Number(student.studentMobile)) : '—'}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ScoreRingSmall percentage={student.percentage} pass={isPassed} />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-navy-900">
              {toLocalNum(student.score)}/{toLocalNum(student.totalPoints)} {t('teacher:quizList.columns.points')}
            </span>
            <Badge variant={badge.variant as any}>
              {t(`teacher:teacherQuizResults.gradeBadge.${badge.label}`)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Question table */}
      <div className="overflow-hidden rounded-card bg-white shadow-card">
        <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-200 text-xs font-medium text-gray-600">
                <th className="px-4 py-3 text-start">{t('teacher:teacherQuizResults.studentBreakdown.columns.question')}</th>
                <th className="px-4 py-3 text-start">{t('teacher:teacherQuizResults.studentBreakdown.columns.type')}</th>
                <th className="px-4 py-3 text-start">{t('teacher:teacherQuizResults.studentBreakdown.columns.answer')}</th>
                <th className="px-4 py-3 text-start">{t('teacher:teacherQuizResults.studentBreakdown.columns.result')}</th>
                <th className="px-4 py-3 text-start">{t('teacher:teacherQuizResults.studentBreakdown.columns.points')}</th>
              </tr>
            </thead>
            <tbody>
              {student.questions.map((q, idx) => {
                const qIsPassed = q.result === 'correct' || q.result === 'graded';
                const isPending = q.result === 'pending';
                return (
                  <tr
                    key={q.questionId}
                    className={cn(
                      'border-b border-gray-100 last:border-0',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-navy-900">
                        {t('teacher:quizGenerator.review.questionLabel', { number: toLocalNum(idx + 1) })}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{q.questionText}</p>
                    </td>
                    <td className="px-4 py-3">
                      <QuestionTypeBadge type={q.type} />
                    </td>
                    <td className="px-4 py-3">
                      <AnswerCell question={q} isPassed={qIsPassed} />
                    </td>
                    <td className="px-4 py-3">
                      <ResultIcon result={q.result} isPending={isPending} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-sm font-bold',
                          isPending ? 'text-warning-500' : qIsPassed ? 'text-success-500' : 'text-danger-500',
                        )}
                      >
                        {isPending ? '—' : toLocalNum(q.awardedPoints ?? 0)}/{toLocalNum(q.maxPoints)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate(`/teacher/quizzes/${quizId}/results`)}
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-cyan-500 transition-colors hover:text-cyan-600"
      >
        <ChevronLeftIcon size={16} className="rtl:rotate-180" />
        {t('teacher:teacherQuizResults.studentBreakdown.backLink')}
      </button>
    </div>
  );
}
