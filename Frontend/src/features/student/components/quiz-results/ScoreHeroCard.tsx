import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { PASS_THRESHOLD, type QuizResultsData } from '@/features/student/types/quizResults';
import { ScoreRing } from './ScoreRing';

interface ScoreHeroCardProps {
  data: QuizResultsData;
}

export function ScoreHeroCard({ data }: ScoreHeroCardProps) {
  const { t } = useTranslation();
  const pass = data.percentage >= PASS_THRESHOLD;

  const stats = [
    {
      key: 'correct',
      icon: CheckCircle,
      color: 'text-success-500',
      value: data.correctCount,
      label: t('quiz:results.correct'),
    },
    {
      key: 'wrong',
      icon: XCircle,
      color: 'text-danger-500',
      value: data.wrongCount,
      label: t('quiz:results.wrong'),
    },
    {
      key: 'pending',
      icon: Clock,
      color: 'text-warning-500',
      value: data.pendingCount,
      label: t('quiz:results.pending'),
    },
  ];

  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-gray-300 bg-white p-6 text-center shadow-card sm:p-8">
      <ScoreRing percentage={data.percentage} pass={pass} />

      <p className={`text-lg font-semibold ${pass ? 'text-success-500' : 'text-danger-500'}`}>
        {pass ? t('quiz:results.passMessage') : t('quiz:results.failMessage')}
      </p>

      {pass ? (
        <div className="flex flex-col gap-1 text-sm text-gray-600">
          <span>
            {t('quiz:results.correctAnswersSummary', {
              correct: toLocalNum(data.correctCount),
              total: toLocalNum(data.totalQuestions),
            })}
          </span>
          <span>
            {t('quiz:results.pointsSummary', {
              score: toLocalNum(data.score),
              total: toLocalNum(data.totalPoints),
            })}
          </span>
        </div>
      ) : (
        <p className="text-sm text-gray-600">{t('quiz:results.failEncouragement')}</p>
      )}

      <div className="grid w-full grid-cols-3 gap-3">
        {stats.map(({ key, icon: Icon, color, value, label }) => (
          <div key={key} className="flex flex-col items-center gap-1 rounded-xl bg-gray-100 p-3">
            <Icon size={20} className={color} />
            <span className="text-base font-bold text-navy-800">{toLocalNum(value)}</span>
            <span className="text-caption text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {data.quizTitle && (
        <p className="text-small text-gray-500">
          {t('quiz:results.metaLine', {
            title: data.quizTitle,
            count: toLocalNum(data.totalQuestions),
          })}
        </p>
      )}
    </div>
  );
}
