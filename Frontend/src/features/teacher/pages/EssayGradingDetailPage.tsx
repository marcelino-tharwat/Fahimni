import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  EssayAvatar,
  EssayBreadcrumb,
  EssayGradingToast,
  EssayPageShell,
  EssayStatusBadge,
} from '@/features/teacher/components/essay-grading/EssayGradingUi';
import { ESSAY_GRADING_CYAN, ESSAY_CARD_SHADOW } from '@/features/teacher/components/essay-grading/essayGradingTokens';
import {
  useEssayGradingDetail,
  useGradeEssays,
} from '@/features/teacher/hooks/useEssayGrading';
import type { EssayAnswerDetail } from '@/features/teacher/types/essayGrading';
import { cn } from '@/shared/lib/utils/cn';

interface GradeField {
  awardedPoints: string;
  feedback: string;
}

function buildInitialFields(essayAnswers: EssayAnswerDetail[]): Record<string, GradeField> {
  const next: Record<string, GradeField> = {};
  for (const essay of essayAnswers) {
    next[essay.questionId] = {
      awardedPoints:
        essay.awardedPoints !== null && essay.awardedPoints !== undefined
          ? String(essay.awardedPoints)
          : '',
      feedback: essay.feedback ?? '',
    };
  }
  return next;
}

function parseGrade(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function EssayQuestionCard({
  essay,
  readOnly,
  field,
  onChange,
  error,
}: {
  essay: EssayAnswerDetail;
  readOnly: boolean;
  field: GradeField;
  onChange: (patch: Partial<GradeField>) => void;
  error: boolean;
}) {
  const { t } = useTranslation('teacher');
  const isGraded = essay.awardedPoints !== null;
  const showReadOnly = readOnly && isGraded;
  const accentColor = showReadOnly ? '#10B981' : '#F59E0B';
  const headerBg = showReadOnly ? '#ECFDF5' : '#FFFBEB';

  return (
    <article
      className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white"
      style={{
        boxShadow: ESSAY_CARD_SHADOW,
        borderInlineStartWidth: 4,
        borderInlineStartColor: accentColor,
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5"
        style={{ background: headerBg, borderBottom: '1px solid #E5E7EB' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#1A103D]">
            {t('essayGrading.questionLabel', { order: essay.order })}
          </span>
          {showReadOnly ? (
            <EssayStatusBadge label={t('essayGrading.statusGraded')} variant="success" />
          ) : (
            <EssayStatusBadge label={t('essayGrading.statusPending')} variant="warning" />
          )}
        </div>
        <span className="shrink-0 text-sm text-[#6B7280]">
          {t('essayGrading.points', { count: essay.maximumPoints })}
        </span>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[#6B7280]">{t('essayGrading.questionText')}</p>
          <p className="text-sm leading-relaxed text-[#1A103D]">{essay.questionText}</p>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-[#6B7280]">{t('essayGrading.studentAnswer')}</p>
          <div className="whitespace-pre-wrap rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm leading-relaxed text-[#1A103D]">
            {essay.studentAnswer}
          </div>
        </div>

        <div className="h-px bg-[#E5E7EB]" />

        {showReadOnly ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-[#6B7280]">{t('essayGrading.markLabel')}</p>
              <span className="text-lg font-bold text-[#10B981]">
                {essay.awardedPoints}/{essay.maximumPoints}
              </span>
            </div>
            {essay.feedback && (
              <div
                className="rounded-[10px] px-4 py-3"
                style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}
              >
                <p className="mb-1 text-xs font-semibold text-[#059669]">
                  {t('essayGrading.feedbackForStudent')}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1A103D]">
                  {essay.feedback}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`grade-${essay.questionId}`} className="text-sm font-medium text-[#1A103D]">
                {t('essayGrading.markLabel')}
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  id={`grade-${essay.questionId}`}
                  value={field.awardedPoints}
                  onChange={(e) => onChange({ awardedPoints: e.target.value })}
                  type="number"
                  min={0}
                  max={essay.maximumPoints}
                  step="any"
                  placeholder="0"
                  dir="ltr"
                  className="h-12 rounded-[10px] border-2 text-center text-base font-bold outline-none transition-all"
                  style={{
                    width: 80,
                    borderColor: error ? '#EF4444' : field.awardedPoints && !error ? '#00C9DB' : '#E5E7EB',
                    boxShadow: error
                      ? '0 0 0 3px rgba(239,68,68,0.1)'
                      : field.awardedPoints && !error
                        ? '0 0 0 3px rgba(0,201,219,0.1)'
                        : 'none',
                    color: '#1A103D',
                  }}
                />
                <span className="text-sm text-[#6B7280]">
                  {t('essayGrading.outOf', { max: essay.maximumPoints })}
                </span>
              </div>
              {error && (
                <p className="flex items-center gap-1 text-xs text-[#EF4444]">
                  <AlertCircle size={11} className="shrink-0" />
                  {t('essayGrading.markRangeError', { max: essay.maximumPoints })}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`feedback-${essay.questionId}`} className="text-sm font-medium text-[#1A103D]">
                {t('essayGrading.feedbackLabel')}{' '}
                <span className="font-normal text-[#9CA3AF]">({t('essayGrading.optional')})</span>
              </label>
              <textarea
                id={`feedback-${essay.questionId}`}
                value={field.feedback}
                onChange={(e) => onChange({ feedback: e.target.value })}
                placeholder={t('essayGrading.feedbackPlaceholder')}
                dir="auto"
                className="min-h-[80px] resize-none rounded-[10px] border border-[#E5E7EB] px-3.5 py-3 text-sm text-[#1A103D] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#00C9DB] focus:ring-2 focus:ring-[#00C9DB]/15"
              />
              <p className="text-[11px] text-[#9CA3AF]">{t('essayGrading.feedbackHint')}</p>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function EssayGradingDetailPage() {
  const { t } = useTranslation('teacher');
  const navigate = useNavigate();
  const { quizId = '', attemptId = '' } = useParams<{ quizId: string; attemptId: string }>();
  const { data, isLoading, isError, refetch } = useEssayGradingDetail(attemptId);
  const gradeMutation = useGradeEssays(attemptId, quizId);

  const readOnly = data?.attempt.status === 'GRADED';
  const initialFields = useMemo(
    () => (data ? buildInitialFields(data.essayAnswers) : {}),
    [data],
  );
  const [fields, setFields] = useState<Record<string, GradeField>>({});
  const [dirty, setDirty] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const activeFields = dirty ? fields : initialFields;

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 4000);
    return () => clearTimeout(timer);
  }, [showToast]);

  const validation = useMemo(() => {
    if (!data || readOnly) return { valid: true, errors: {} as Record<string, boolean> };
    const errors: Record<string, boolean> = {};
    let valid = true;
    for (const essay of data.essayAnswers) {
      const field = activeFields[essay.questionId];
      const grade = parseGrade(field?.awardedPoints ?? '');
      const hasError =
        grade === null ||
        Number.isNaN(grade) ||
        grade < 0 ||
        grade > essay.maximumPoints;
      if (hasError) {
        errors[essay.questionId] = true;
        valid = false;
      }
    }
    return { valid, errors };
  }, [data, activeFields, readOnly]);

  const gradedCount = useMemo(() => {
    if (!data) return 0;
    if (readOnly) return data.essayAnswers.length;
    return data.essayAnswers.filter((e) => {
      const g = parseGrade(activeFields[e.questionId]?.awardedPoints ?? '');
      return g !== null && !Number.isNaN(g);
    }).length;
  }, [data, activeFields, readOnly]);

  const totalPts = useMemo(() => {
    if (!data) return 0;
    if (readOnly) {
      return data.essayAnswers.reduce((s, e) => s + (e.awardedPoints ?? 0), 0);
    }
    return data.essayAnswers.reduce((s, e) => {
      const g = parseGrade(activeFields[e.questionId]?.awardedPoints ?? '');
      return s + (g !== null && !Number.isNaN(g) ? g : 0);
    }, 0);
  }, [data, activeFields, readOnly]);

  const maxPts = data?.essayAnswers.reduce((s, e) => s + e.maximumPoints, 0) ?? 0;

  async function handleSubmit() {
    if (!data || readOnly || !validation.valid) return;
    setSubmitError(null);
    const grades = data.essayAnswers.map((essay) => {
      const field = activeFields[essay.questionId]!;
      const awardedPoints = parseGrade(field.awardedPoints)!;
      return {
        questionId: essay.questionId,
        awardedPoints,
        ...(field.feedback.trim() ? { feedback: field.feedback.trim() } : {}),
      };
    });

    try {
      await gradeMutation.mutateAsync({ grades });
      setShowToast(true);
      navigate(`/teacher/essay-grading/${quizId}`);
    } catch {
      setSubmitError(t('essayGrading.submitError'));
    }
  }

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
        <p className="text-sm text-[#6B7280]">{t('essayGrading.detailError')}</p>
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

  return (
    <>
      <EssayGradingToast message={t('essayGrading.submitSuccess')} show={showToast} />
      <div className="pb-24">
        <EssayPageShell>
          <EssayBreadcrumb
            items={[
              { label: t('essayGrading.pageTitle'), href: '/teacher/essay-grading' },
              { label: data.quiz.title, href: `/teacher/essay-grading/${quizId}` },
              { label: data.student.displayName, active: true },
            ]}
            onNavigate={(href) => navigate(href)}
          />

          <div className="flex items-center gap-3.5">
            <EssayAvatar name={data.student.displayName} size={48} />
            <div>
              <h1 className="text-xl font-bold text-[#1A103D]">{data.student.displayName}</h1>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">{data.quiz.title}</p>
              <p className="mt-0.5 text-sm text-[#9CA3AF]">
                {t('essayGrading.detailMeta', {
                  count: data.essayAnswers.length,
                  points: maxPts,
                })}
              </p>
            </div>
          </div>

          {data.essayAnswers.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#6B7280]">{t('essayGrading.noEssayAnswers')}</p>
          ) : (
            <div className="flex flex-col gap-5">
              {data.essayAnswers.map((essay) => (
                <EssayQuestionCard
                  key={essay.questionId}
                  essay={essay}
                  readOnly={readOnly}
                  field={activeFields[essay.questionId] ?? { awardedPoints: '', feedback: '' }}
                  onChange={(patch) => {
                    setDirty(true);
                    setFields((prev) => ({
                      ...(dirty ? prev : initialFields),
                      [essay.questionId]: {
                        ...(dirty ? prev[essay.questionId] : initialFields[essay.questionId]),
                        ...patch,
                      },
                    }));
                  }}
                  error={Boolean(validation.errors[essay.questionId])}
                />
              ))}
            </div>
          )}

          {submitError && (
            <p className="text-sm text-[#EF4444]" role="alert">
              {submitError}
            </p>
          )}
        </EssayPageShell>
      </div>

      {!readOnly && data.essayAnswers.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E7EB] bg-white px-4 py-3.5 sm:px-6"
          style={{ boxShadow: '0 -2px 12px rgba(0,0,0,0.06)' }}
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <p className="text-sm text-[#6B7280]">
              {t('essayGrading.progress', {
                graded: gradedCount,
                total: data.essayAnswers.length,
                score: totalPts,
                max: maxPts,
              })}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!validation.valid || gradeMutation.isPending}
              className={cn(
                'flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold text-white transition-all active:scale-[0.97]',
                (!validation.valid || gradeMutation.isPending) && 'cursor-not-allowed opacity-50',
              )}
              style={{ background: ESSAY_GRADING_CYAN }}
            >
              {gradeMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {t('essayGrading.submitting')}
                </>
              ) : (
                t('essayGrading.submitGrading')
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
