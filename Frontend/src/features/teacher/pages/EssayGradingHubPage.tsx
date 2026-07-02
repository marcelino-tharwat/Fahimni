import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, FileText, ChevronLeft, Loader2 } from 'lucide-react';
import {
  EssayPageShell,
  EssayStatusBadge,
} from '@/features/teacher/components/essay-grading/EssayGradingUi';
import {
  ESSAY_CARD_SHADOW,
  essayRowClass,
} from '@/features/teacher/components/essay-grading/essayGradingTokens';
import { useEssayGradingHub } from '@/features/teacher/hooks/useEssayGrading';
import type { EssayGradingHubItem } from '@/features/teacher/types/essayGrading';

function QuizCard({ quiz }: { quiz: EssayGradingHubItem }) {
  const { t } = useTranslation('teacher');
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const needsGrading = quiz.pendingCount > 0 || quiz.partiallyGradedCount > 0;
  const isFullyGraded = !needsGrading && quiz.studentSubmissionCount > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/teacher/essay-grading/${quiz.quizId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/teacher/essay-grading/${quiz.quizId}`);
        }
      }}
      className={essayRowClass(hovered)}
      style={{
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.10)' : ESSAY_CARD_SHADOW,
        borderInlineStartWidth: 4,
        borderInlineStartColor: isFullyGraded ? '#10B981' : '#F59E0B',
      }}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: isFullyGraded ? '#ECFDF5' : '#FFFBEB' }}
        >
          <FileText size={20} style={{ color: isFullyGraded ? '#10B981' : '#F59E0B' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#1A103D]">{quiz.quizTitle}</p>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            {quiz.chapterTitle}
            {quiz.chapterTitle ? ' • ' : ''}
            {t('essayGrading.essayQuestionCount', { count: quiz.essayQuestionCount })}
          </p>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            {t('essayGrading.studentSubmissionCount', { count: quiz.studentSubmissionCount })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isFullyGraded ? (
            <EssayStatusBadge label={t('essayGrading.fullyGraded')} variant="success" />
          ) : (
            <EssayStatusBadge
              label={t('essayGrading.ungradedCount', {
                count: quiz.pendingCount + quiz.partiallyGradedCount,
              })}
              variant="warning"
            />
          )}
          <ChevronLeft size={16} className="text-[#C4C9D0]" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function EssayGradingHubPage() {
  const { t } = useTranslation('teacher');
  const { data, isLoading, isError, refetch } = useEssayGradingHub();
  const quizzes = data?.data ?? [];

  const quizzesNeedingGrading = quizzes.filter(
    (q) => q.pendingCount > 0 || q.partiallyGradedCount > 0,
  ).length;
  const totalUngraded = quizzes.reduce(
    (sum, q) => sum + q.pendingCount + q.partiallyGradedCount,
    0,
  );

  if (isLoading) {
    return (
      <EssayPageShell className="items-center py-20">
        <Loader2 className="animate-spin text-[#00C9DB]" size={32} aria-label={t('essayGrading.loading')} />
      </EssayPageShell>
    );
  }

  if (isError) {
    return (
      <EssayPageShell className="items-center py-20 text-center">
        <p className="text-sm text-[#6B7280]">{t('essayGrading.loadError')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 h-10 rounded-xl border border-[#E5E7EB] px-5 text-sm font-medium text-[#6B7280] hover:border-[#00C9DB] hover:text-[#00C9DB]"
        >
          {t('essayGrading.retry')}
        </button>
      </EssayPageShell>
    );
  }

  if (quizzes.length === 0) {
    return (
      <EssayPageShell className="items-center py-20 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: '#ECFDF5', border: '3px solid #A7F3D0' }}
        >
          <FileText size={36} style={{ color: '#10B981' }} />
        </div>
        <p className="mt-4 text-lg font-semibold text-[#6B7280]">{t('essayGrading.hubEmpty')}</p>
      </EssayPageShell>
    );
  }

  return (
    <EssayPageShell>
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A103D]">{t('essayGrading.pageTitle')}</h1>
        <p className="mt-0.5 text-sm text-[#6B7280]">{t('essayGrading.pageSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          {
            icon: <ClipboardList size={16} />,
            bg: 'linear-gradient(135deg,#F59E0B,#D97706)',
            val: quizzesNeedingGrading,
            label: t('essayGrading.statsQuizzesNeeding'),
          },
          {
            icon: <FileText size={16} />,
            bg: 'linear-gradient(135deg,#EF4444,#DC2626)',
            val: totalUngraded,
            label: t('essayGrading.statsUngradedEssays'),
          },
        ].map(({ icon, bg, val, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-[14px] border border-[#E5E7EB] bg-white p-4"
            style={{ boxShadow: ESSAY_CARD_SHADOW }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: bg }}
            >
              {icon}
            </div>
            <div>
              <p className="text-xl font-bold text-[#1A103D]">{val}</p>
              <p className="text-xs text-[#6B7280]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {quizzes.map((quiz) => (
          <QuizCard key={quiz.quizId} quiz={quiz} />
        ))}
      </div>
    </EssayPageShell>
  );
}
