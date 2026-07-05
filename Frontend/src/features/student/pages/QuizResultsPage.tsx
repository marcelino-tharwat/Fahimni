import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import {
  ScoreHeroCard,
  ResultQuestionNavigator,
  ResultFilterBar,
  ResultQuestionCard,
  ResultFooterActions,
  QuizResultsSkeleton,
} from '@/features/student/components/quiz-results';
import {
  type QuizResultsData,
  type ResultFilterKey,
} from '@/features/student/types/quizResults';
import { ProtectedContent } from '@/shared/components/content-protection';
import { getAttemptResults, buildQuizResults } from '@/features/student/api/quiz';
import { resolveResultTone } from '@/features/student/lib/quizResultStats';

/** Shown when results can't be loaded (invalid/missing attempt, fetch failure). */
function ErrorFallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 py-20 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-200">
        <ClipboardList size={36} className="text-gray-500" />
      </div>
      <h1 className="text-h3 text-navy-800">{t('quiz:results.unavailableTitle')}</h1>
      <p className="max-w-xs text-body text-gray-600">{t('quiz:results.unavailableMsg')}</p>
      <button
        type="button"
        onClick={() => navigate('/student/quizzes')}
        className="h-11 rounded-btn bg-cyan-gradient px-8 text-sm font-bold text-white"
      >
        {t('quiz:results.backToQuizzes')}
      </button>
    </div>
  );
}

export function QuizResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { attemptId } = useParams<{ quizId: string; attemptId: string }>();
  const location = useLocation();

  // Router state (instant, from the submit flow). Absent on refresh / direct
  // visit / "View Result" from the list — those fall back to the GET endpoint.
  const stateData = location.state as QuizResultsData | null;

  const [data, setData] = useState<QuizResultsData | null>(stateData);
  const [loading, setLoading] = useState(!stateData);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<ResultFilterKey>('all');

  useEffect(() => {
    if (data || !attemptId) return;

    setLoading(true);
    getAttemptResults(attemptId)
      .then((response) => {
        setData(buildQuizResults(response));
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [attemptId, data]);

  const counts = useMemo(
    () => ({
      all: data?.results.length ?? 0,
      correct: data?.correctCount ?? 0,
      wrong: data?.wrongCount ?? 0,
      pending: data?.pendingCount ?? 0,
    }),
    [data],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.results;
    return data.results.filter((r) => resolveResultTone(r) === filter);
  }, [data, filter]);

  if (loading) {
    return <QuizResultsSkeleton />;
  }

  if (error || !data) {
    return <ErrorFallback />;
  }

  // HIDE_ALL_RESULTS: the backend returned no questions and a review message —
  // show only the message until the teacher completes essay review.
  if (data.results.length === 0 && data.reviewMessage) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div
          role="status"
          className="rounded-card border border-warning-300 bg-warning-50 p-8 text-center text-body font-medium text-warning-700 shadow-card"
        >
          {data.reviewMessage}
        </div>
        <ResultFooterActions onDashboard={() => navigate('/student/dashboard')} />
      </div>
    );
  }

  return (
    <ProtectedContent
      policy={{
        disableCopy: true,
        disableContextMenu: true,
        disablePrint: true,
        disableSelection: true,
      }}
      className="print-protected"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        {data.reviewMessage && (
          <div
            role="status"
            className="rounded-card border border-warning-300 bg-warning-50 px-4 py-3 text-center text-body font-medium text-warning-700 shadow-card"
          >
            {data.reviewMessage}
          </div>
        )}

        <ScoreHeroCard data={data} />

        <ResultQuestionNavigator results={data.results} />

        <ResultFilterBar active={filter} counts={counts} onChange={setFilter} />

        {filtered.length > 0 ? (
          <div className="flex flex-col gap-5">
            {filtered.map((result) => {
              const index = data.results.indexOf(result);
              return <ResultQuestionCard key={result.question.id} result={result} index={index} />;
            })}
          </div>
        ) : (
          <p className="rounded-card border border-gray-300 bg-white p-8 text-center text-body text-gray-500 shadow-card">
            {t('quiz:results.noQuestionsInFilter')}
          </p>
        )}

        <ResultFooterActions onDashboard={() => navigate('/student/dashboard')} />
      </div>
    </ProtectedContent>
  );
}
