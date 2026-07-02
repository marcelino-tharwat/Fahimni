import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Loader2 } from 'lucide-react';
import {
  EssayAvatar,
  EssayBreadcrumb,
  EssayPageShell,
  EssayStatusBadge,
} from '@/features/teacher/components/essay-grading/EssayGradingUi';
import {
  ESSAY_CARD_SHADOW,
  essayRowClass,
} from '@/features/teacher/components/essay-grading/essayGradingTokens';
import { useEssaySubmissions } from '@/features/teacher/hooks/useEssayGrading';
import type { EssayGradingStatus, EssaySubmissionRow } from '@/features/teacher/types/essayGrading';

const STATUS_BORDER: Record<EssayGradingStatus, string> = {
  PENDING: '#F59E0B',
  PARTIALLY_GRADED: '#00C9DB',
  GRADED: '#10B981',
};

function statusBadge(
  status: EssayGradingStatus,
  t: (key: string, opts?: Record<string, unknown>) => string,
  row: EssaySubmissionRow,
) {
  if (status === 'PENDING') {
    return { label: t('essayGrading.statusPending'), variant: 'warning' as const };
  }
  if (status === 'PARTIALLY_GRADED') {
    return {
      label: t('essayGrading.statusPartial', {
        graded: row.gradedEssayQuestionCount,
        total: row.essayQuestionCount,
      }),
      variant: 'cyan' as const,
    };
  }
  return { label: t('essayGrading.statusGraded'), variant: 'success' as const };
}

function SubmissionRow({ row, quizId }: { row: EssaySubmissionRow; quizId: string }) {
  const { t } = useTranslation('teacher');
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const badge = statusBadge(row.status, t, row);

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/teacher/essay-grading/${quizId}/${row.attemptId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/teacher/essay-grading/${quizId}/${row.attemptId}`);
        }
      }}
      className={essayRowClass(hovered)}
      style={{
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.10)' : ESSAY_CARD_SHADOW,
        borderInlineStartWidth: 4,
        borderInlineStartColor: STATUS_BORDER[row.status],
      }}
    >
      <div className="flex items-center gap-3.5 px-5 py-3.5">
        <EssayAvatar name={row.studentName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#1A103D]">{row.studentName}</p>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            {t('essayGrading.essayQuestionCount', { count: row.essayQuestionCount })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <EssayStatusBadge label={badge.label} variant={badge.variant} />
          {row.earnedEssayScore !== null && (
            <span className="text-sm font-bold text-[#1A103D]">
              {row.earnedEssayScore}/{row.maximumEssayScore}
            </span>
          )}
          <ChevronLeft size={15} className="text-[#C4C9D0]" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function EssaySubmissionsPage() {
  const { t } = useTranslation('teacher');
  const navigate = useNavigate();
  const { quizId = '' } = useParams<{ quizId: string }>();
  const { data, isLoading, isError, refetch } = useEssaySubmissions(quizId);

  if (isLoading) {
    return (
      <EssayPageShell className="items-center py-20">
        <Loader2 className="animate-spin text-[#00C9DB]" size={32} />
      </EssayPageShell>
    );
  }

  if (isError || !data) {
    return (
      <EssayPageShell className="items-center py-20 text-center">
        <p className="text-sm text-[#6B7280]">{t('essayGrading.loadError')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 h-10 rounded-xl border border-[#E5E7EB] px-5 text-sm font-medium text-[#6B7280]"
        >
          {t('essayGrading.retry')}
        </button>
      </EssayPageShell>
    );
  }

  const { quiz, summary, submissions } = data.data;
  const ungradedCount = summary.pendingCount + summary.partiallyGradedCount;

  return (
    <EssayPageShell>
      <EssayBreadcrumb
        items={[
          { label: t('essayGrading.pageTitle'), href: '/teacher/essay-grading' },
          { label: quiz.title, active: true },
        ]}
        onNavigate={(href) => navigate(href)}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1A103D]">{quiz.title}</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">{t('essayGrading.submissionsSubtitle')}</p>
          {quiz.chapterTitle && (
            <p className="mt-0.5 text-xs text-[#9CA3AF]">{quiz.chapterTitle}</p>
          )}
        </div>
        <EssayStatusBadge
          label={t('essayGrading.summaryBadge', {
            ungraded: ungradedCount,
            total: summary.totalStudents,
          })}
          variant="warning"
        />
      </div>

      {submissions.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#6B7280]">
          {t('essayGrading.submissionsEmpty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {submissions.map((row) => (
            <SubmissionRow key={row.attemptId} row={row} quizId={quizId} />
          ))}
        </div>
      )}
    </EssayPageShell>
  );
}
