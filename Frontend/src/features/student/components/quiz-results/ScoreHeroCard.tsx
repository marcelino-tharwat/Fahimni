import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { cn } from '@/shared/lib/utils/cn';
import { PASS_THRESHOLD, type QuizResultsData } from '@/features/student/types/quizResults';
import { ScoreRing } from './ScoreRing';

interface ScoreHeroCardProps {
  data: QuizResultsData;
}

export function ScoreHeroCard({ data }: ScoreHeroCardProps) {
  const { t } = useTranslation();
  const pass = data.percentage >= PASS_THRESHOLD;
  const scoreHidden = data.finalScoreHidden === true;
  const correctnessHidden = data.correctnessHidden === true;

  // When per-question correctness is hidden, the correct/wrong tiles (an
  // aggregate right/wrong signal) are suppressed — only the pending tile, which
  // reveals no correctness, may remain.
  const stats = [
    ...(correctnessHidden
      ? []
      : [
          {
            key: 'correct' as const,
            icon: CheckCircle,
            color: 'text-success-500',
            value: data.correctCount,
            label: t('quiz:results.correct'),
          },
          {
            key: 'wrong' as const,
            icon: XCircle,
            color: 'text-danger-500',
            value: data.wrongCount,
            label: t('quiz:results.wrong'),
          },
        ]),
    ...(data.pendingCount > 0
      ? [
          {
            key: 'pending' as const,
            icon: Clock,
            color: 'text-warning-500',
            value: data.pendingCount,
            label: t('quiz:results.pending'),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-gray-300 bg-white p-6 text-center shadow-card sm:p-8">
      {scoreHidden ? (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning-50">
            <Clock size={36} className="text-warning-500" />
          </div>
          <p className="text-lg font-semibold text-warning-700">
            {t('quiz:results.scoreUnderReview')}
          </p>
        </>
      ) : (
        <>
          <ScoreRing percentage={data.percentage} pass={pass} />

          <p className={`text-lg font-semibold ${pass ? 'text-success-500' : 'text-danger-500'}`}>
            {pass ? t('quiz:results.passMessage') : t('quiz:results.failMessage')}
          </p>

          {pass ? (
            <div className="flex flex-col gap-1 text-sm text-gray-600">
              {/* correctAnswersSummary is a right/wrong aggregate — hide it when
                  correctness is hidden; the points summary (score) may stay. */}
              {!correctnessHidden && (
                <span>
                  {t('quiz:results.correctAnswersSummary', {
                    correct: toLocalNum(data.correctCount),
                    total: toLocalNum(data.totalQuestions),
                  })}
                </span>
              )}
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
        </>
      )}

      {stats.length > 0 && (
        <div
          className={cn(
            'grid w-full gap-3',
            stats.length === 3 ? 'grid-cols-3' : stats.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {stats.map(({ key, icon: Icon, color, value, label }) => (
            <div key={key} className="flex flex-col items-center gap-1 rounded-xl bg-gray-100 p-3">
              <Icon size={20} className={color} />
              <span className="text-base font-bold text-navy-800">{toLocalNum(value)}</span>
              <span className="text-caption text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      )}

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
