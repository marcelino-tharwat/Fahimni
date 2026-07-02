import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  CheckCircle,
  Sparkles,
  ChevronDown,
  BookOpen,
  FileText,
  XCircle,
  Clock,
  Play,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { Skeleton, Badge } from '@/shared/components/ui';
import { useStudentQuizzes } from '@/features/student/hooks/useStudentQuizzes';
import { resolveQuizStudentAction } from '@/features/student/lib/quizNavigation';
import type { ChapterGroup, QuizItem } from '@/features/student/types/studentQuiz';

const statusConfig: Record<
  QuizItem['status'],
  { bg: string; iconColor: string; icon: typeof FileText }
> = {
  new: { bg: 'bg-cyan-50', iconColor: 'text-cyan-500', icon: FileText },
  passed: { bg: 'bg-success-50', iconColor: 'text-success-500', icon: CheckCircle },
  failed: { bg: 'bg-danger-50', iconColor: 'text-danger-500', icon: XCircle },
  pending: { bg: 'bg-warning-50', iconColor: 'text-warning-500', icon: Clock },
};

const difficultyVariant: Record<QuizItem['difficulty'], 'success' | 'warning' | 'danger'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'danger',
};

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex h-[72px] animate-pulse items-center gap-4 rounded-card bg-white p-4 shadow-card">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gray-200" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-16 rounded bg-gray-200" />
            <div className="h-3 w-20 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AccordionSkeleton() {
  return (
    <div className="animate-pulse rounded-card bg-white shadow-card">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="h-5 w-5 rounded bg-gray-200" />
        <div className="h-5 flex-1 rounded bg-gray-200" />
        <div className="h-5 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="border-t border-gray-300">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-200" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-3/5 rounded bg-gray-200" />
              <div className="h-3 w-2/5 rounded bg-gray-200" />
            </div>
            <div className="h-8 w-24 rounded-btn bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizRow({
  quiz,
  onStart,
  onViewResult,
}: {
  quiz: QuizItem;
  onStart: (id: string) => void;
  onViewResult: (quizId: string, attemptId: string) => void;
}) {
  const { t } = useTranslation();
  const cfg = statusConfig[quiz.status];
  const Icon = cfg.icon;
  const action = resolveQuizStudentAction(quiz);

  return (
    <div className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', cfg.bg)}>
        <Icon size={20} className={cfg.iconColor} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-cairo text-body font-semibold text-navy-800">{quiz.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 font-cairo text-caption text-gray-600">
          <span className="inline-flex items-center gap-1">
            <FileText size={12} />
            {t('student:quizzes.quiz.questions', { count: quiz.questionCount })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles size={12} />
            {t('student:quizzes.quiz.points', { count: quiz.points })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} />
            {quiz.durationMinutes != null
              ? t('student:quizzes.quiz.minutes', { count: quiz.durationMinutes })
              : '—'}
          </span>
        </div>

        <div className="mt-1 sm:hidden">
          <Badge
            variant={
              quiz.status === 'new'
                ? 'info'
                : quiz.status === 'passed'
                  ? 'success'
                  : quiz.status === 'failed'
                    ? 'danger'
                    : 'warning'
            }
          >
            {quiz.status === 'passed' || quiz.status === 'failed'
              ? t(`quiz:quiz.status.${quiz.status}`, { score: quiz.score })
              : t(`quiz:quiz.status.${quiz.status}`)}
          </Badge>
        </div>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
        <Badge variant={difficultyVariant[quiz.difficulty]}>
          {t(`quiz:difficulty.${quiz.difficulty}`)}
        </Badge>
        <Badge
          variant={
            quiz.status === 'new'
              ? 'info'
              : quiz.status === 'passed'
                ? 'success'
                : quiz.status === 'failed'
                  ? 'danger'
                  : 'warning'
          }
        >
          {quiz.status === 'passed' || quiz.status === 'failed'
            ? t(`quiz:quiz.status.${quiz.status}`, { score: quiz.score })
            : t(`quiz:quiz.status.${quiz.status}`)}
        </Badge>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {action === 'start' && (
          <button
            type="button"
            onClick={() => onStart(quiz.id)}
            className="inline-flex items-center gap-1.5 rounded-btn bg-cyan-gradient px-4 py-2 font-cairo text-small font-bold text-white shadow-glow transition-opacity hover:opacity-90"
          >
            <Play size={14} />
            {t('quiz:quiz.action.start')}
          </button>
        )}
        {action === 'resume' && (
          <button
            type="button"
            onClick={() => onStart(quiz.id)}
            className="inline-flex items-center gap-1.5 rounded-btn bg-cyan-gradient px-4 py-2 font-cairo text-small font-bold text-white shadow-glow transition-opacity hover:opacity-90"
          >
            <Play size={14} />
            {t('quiz:quiz.action.continue')}
          </button>
        )}
        {action === 'viewResult' && quiz.attemptId && (
          <button
            type="button"
            onClick={() => onViewResult(quiz.id, quiz.attemptId!)}
            className="inline-flex items-center gap-1.5 rounded-btn border-2 border-cyan-500 px-4 py-2 font-cairo text-small font-bold text-cyan-500 transition-colors hover:bg-cyan-50"
          >
            <Eye size={14} />
            {t('quiz:quiz.action.viewResult')}
          </button>
        )}
        {quiz.retakeAllowed && quiz.status === 'failed' && (
          <button
            type="button"
            onClick={() => onStart(quiz.id)}
            className="font-cairo text-small font-medium text-cyan-500 transition-opacity hover:opacity-70"
          >
            {t('quiz:quiz.action.retake')}
          </button>
        )}
      </div>
    </div>
  );
}

function ChapterAccordion({
  chapter,
  isOpen,
  onToggle,
  onStart,
  onViewResult,
}: {
  chapter: ChapterGroup;
  isOpen: boolean;
  onToggle: () => void;
  onStart: (id: string) => void;
  onViewResult: (quizId: string, attemptId: string) => void;
}) {
  const { t } = useTranslation();
  const done = chapter.quizzes.filter(
    (q) => q.status === 'passed' || q.status === 'failed',
  ).length;
  const total = chapter.quizzes.length;
  const allDone = total > 0 && done === total;

  return (
    <div className="rounded-card bg-white shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-start"
      >
        <ChevronDown
          size={20}
          className={cn(
            'shrink-0 text-gray-500 transition-transform',
            !isOpen && '-rotate-90',
          )}
        />
        <span className="flex-1 truncate font-cairo text-h3 text-navy-900">
          {chapter.title}
        </span>
        <Badge variant="info">{chapter.stage}</Badge>
        <span className="shrink-0 font-cairo text-caption text-gray-500">
          {t('student:quizzes.chapter.quizCount', { count: total })}
        </span>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 font-cairo text-caption',
            allDone ? 'text-success-500' : 'text-gray-500',
          )}
        >
          {allDone && <CheckCircle size={14} />}
          {t('student:quizzes.chapter.progress', { done, total })}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-gray-300">
          {total === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <BookOpen size={28} className="text-gray-400" />
              <p className="font-cairo text-body text-gray-500">
                {t('student:quizzes.chapter.noQuizzes')}
              </p>
            </div>
          ) : (
            chapter.quizzes.map((quiz) => (
              <div key={quiz.id} className="border-b border-gray-300 last:border-b-0">
                <QuizRow quiz={quiz} onStart={onStart} onViewResult={onViewResult} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function StudentQuizListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useStudentQuizzes();
  const [accordionState, setAccordionState] = useState<Record<string, boolean>>({});

  const isAccordionOpen = useCallback(
    (chapterId: string) => {
      if (!(chapterId in accordionState) && data) {
        const ch = data.chapters.find((c) => c.id === chapterId);
        return ch?.defaultOpen ?? false;
      }
      return accordionState[chapterId] ?? false;
    },
    [accordionState, data],
  );

  const toggleAccordion = useCallback((chapterId: string) => {
    setAccordionState((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  }, []);

  const handleStart = useCallback(
    (quizId: string) => navigate(`/student/quizzes/${quizId}`),
    [navigate],
  );

  const handleViewResult = useCallback(
    (quizId: string, attemptId: string) =>
      navigate(`/student/quizzes/${quizId}/results/${attemptId}`),
    [navigate],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex animate-pulse flex-col gap-2">
          <div className="h-7 w-48 rounded bg-gray-200" />
          <div className="h-4 w-64 rounded bg-gray-200" />
        </div>
        <StatsSkeleton />
        <AccordionSkeleton />
        <AccordionSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertCircle size={48} className="text-danger-500" />
        <h2 className="font-cairo text-h2 text-navy-900">{t('student:quizzes.error.title')}</h2>
        <p className="font-cairo text-body text-gray-600">{t('student:quizzes.error.description')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-btn bg-cyan-gradient px-6 py-2 font-cairo text-small font-bold text-white shadow-glow transition-opacity hover:opacity-90"
        >
          {t('student:quizzes.error.retry')}
        </button>
      </div>
    );
  }

  if (!data || data.chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex items-center justify-center rounded-xl bg-gray-200 p-5">
          <ClipboardList size={64} className="text-gray-400" />
        </div>
        <h2 className="font-cairo text-h2 text-navy-900">{t('student:quizzes.empty.title')}</h2>
        <p className="max-w-md font-cairo text-body text-gray-600">
          {t('student:quizzes.empty.description')}
        </p>
        <button
          type="button"
          onClick={() => navigate('/student/dashboard')}
          className="rounded-btn bg-cyan-gradient px-6 py-2 font-cairo text-small font-bold text-white shadow-glow transition-opacity hover:opacity-90"
        >
          {t('student:quizzes.empty.cta')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-[88px] md:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-cairo text-h2 text-navy-900">{t('student:quizzes.pageTitle')}</h1>
          <p className="mt-1 font-cairo text-body text-gray-600">
            {t('student:quizzes.pageSubtitle')}
          </p>
        </div>

        {data.totalCount > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-badge bg-cyan-50 px-3 py-1 font-cairo text-small font-medium text-cyan-700">
              <Sparkles size={14} />
              {data.newCount} {t('student:quizzes.stats.new')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-badge bg-success-50 px-3 py-1 font-cairo text-small font-medium text-success-700">
              <CheckCircle size={14} />
              {data.completedCount} {t('student:quizzes.stats.completed')}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-card bg-white p-4 shadow-card">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-gradient">
            <ClipboardList size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-cairo text-xl font-bold text-navy-900">{data.totalCount}</span>
            <span className="font-cairo text-caption text-gray-600">
              {t('student:quizzes.stats.total')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-card bg-white p-4 shadow-card">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
          >
            <CheckCircle size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-cairo text-xl font-bold text-navy-900">{data.completedCount}</span>
            <span className="font-cairo text-caption text-gray-600">
              {t('student:quizzes.stats.completed')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-card bg-white p-4 shadow-card">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-gradient">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-cairo text-xl font-bold text-navy-900">{data.newCount}</span>
            <span className="font-cairo text-caption text-gray-600">
              {t('student:quizzes.stats.new')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {data.chapters.map((chapter) => (
          <ChapterAccordion
            key={chapter.id}
            chapter={chapter}
            isOpen={isAccordionOpen(chapter.id)}
            onToggle={() => toggleAccordion(chapter.id)}
            onStart={handleStart}
            onViewResult={handleViewResult}
          />
        ))}
      </div>
    </div>
  );
}
