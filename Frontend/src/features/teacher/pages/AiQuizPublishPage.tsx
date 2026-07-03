import { useMemo, useReducer, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Link, Settings, FileText, AlertTriangle, CheckCircle,
  Loader2, ArrowLeft, ArrowRight, BookOpen,
} from 'lucide-react';
import { Button, Modal } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils/cn';
import { QuizStepper } from '@/features/teacher/components/quiz-generator';
import { useDraftQuiz } from '@/features/teacher/hooks/useQuizReview';
import { useStagesList, useChaptersByStage } from '@/features/teacher/hooks/useQuizGeneration';
import { useAssignQuiz, usePublishQuiz, useUpdateQuiz } from '@/features/teacher/hooks/useQuizList';
import { chaptersApi } from '@/features/teacher/api/chapters';
import { formatQuizScopeLabel } from '@/features/teacher/lib/quizScopeLabel';
import type { DraftQuestion } from '@/features/teacher/api/quizGeneration';

type PublishUIState = 'idle' | 'confirm-modal' | 'loading' | 'success';

interface PublishFormState {
  stageId: string;
  chapterId: string;
  quizTitle: string;
  timeLimitMinutes: number;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showResultImmediately: boolean;
  showCorrectAnswers: boolean;
  uiState: PublishUIState;
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof PublishFormState; value: unknown }
  | { type: 'SET_UI_STATE'; value: PublishUIState }
  | { type: 'RESET' };

const defaultForm = (overrides?: Partial<PublishFormState>): PublishFormState => ({
  stageId: '',
  chapterId: '',
  quizTitle: '',
  timeLimitMinutes: 0,
  passingScore: 50,
  shuffleQuestions: false,
  shuffleAnswers: false,
  showResultImmediately: true,
  showCorrectAnswers: true,
  uiState: 'idle' as PublishUIState,
  ...overrides,
});

function formReducer(state: PublishFormState, action: FormAction): PublishFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value as never };
    case 'SET_UI_STATE':
      return { ...state, uiState: action.value };
    case 'RESET':
      return defaultForm();
    default:
      return state;
  }
}

function computeQuestionTypeCounts(questions: DraftQuestion[]) {
  const counts: Record<string, number> = {};
  for (const q of questions) {
    const type = q.type === 'TRUE_FALSE' ? 'TF' : q.type;
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

function computeTotalPoints(questions: DraftQuestion[]) {
  return questions.reduce((sum, q) => sum + (q.points ?? 1), 0);
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="text-cyan-500">{icon}</span>
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
    </div>
  );
}

export function AiQuizPublishPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { t, i18n } = useTranslation();
  const BackArrow = i18n.language === 'ar' ? ArrowRight : ArrowLeft;
  const navigate = useNavigate();

  const { data: draftQuiz, isLoading: draftLoading } = useDraftQuiz(quizId);
  const assignQuiz = useAssignQuiz();
  const publishQuiz = usePublishQuiz();
  const updateQuiz = useUpdateQuiz();

  const [form, dispatch] = useReducer(formReducer, defaultForm());
  const [validationError, setValidationError] = useState('');

  const { data: stages = [] } = useStagesList();
  const { data: chapters = [] } = useChaptersByStage(form.stageId);

  const effectiveChapterId = form.chapterId || draftQuiz?.chapterId || '';
  const hasPresetScope = Boolean(draftQuiz?.chapterId);

  const { data: chapterDetail } = useQuery({
    queryKey: ['teacher', 'chapter', effectiveChapterId],
    queryFn: () => chaptersApi.getChapter(effectiveChapterId),
    enabled: Boolean(effectiveChapterId),
  });

  const stageName = useMemo(() => {
    const stageId = chapterDetail?.stageId ?? form.stageId;
    return stages.find((s) => s.id === stageId)?.name ?? '—';
  }, [chapterDetail?.stageId, form.stageId, stages]);

  const chapterName = useMemo(() => {
    return (
      draftQuiz?.scope?.chapter?.title ??
      chapterDetail?.name ??
      chapters.find((c) => c.id === effectiveChapterId)?.name ??
      ''
    );
  }, [draftQuiz?.scope?.chapter?.title, chapterDetail?.name, chapters, effectiveChapterId]);

  const scopeLabel = useMemo(() => {
    if (!draftQuiz?.scope) return null;
    return formatQuizScopeLabel(draftQuiz.scope, t);
  }, [draftQuiz?.scope, t]);

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === effectiveChapterId),
    [chapters, effectiveChapterId],
  );

  const publishedChapterLabel = chapterName || selectedChapter?.name || '';

  const chapterOptions = useMemo(
    () => chapters.map((c) => ({
      value: c.id,
      label: `${c.name} (${(c as unknown as { lessonsCount?: number }).lessonsCount ?? 0} دروس)`,
    })),
    [chapters],
  );

  const isPublishDisabled = !effectiveChapterId;

  useEffect(() => {
    if (!draftQuiz) return;
    dispatch({ type: 'SET_FIELD', field: 'quizTitle', value: draftQuiz.title });
    if (draftQuiz.chapterId) {
      dispatch({ type: 'SET_FIELD', field: 'chapterId', value: draftQuiz.chapterId });
    }
    if (draftQuiz.durationMinutes != null) {
      dispatch({ type: 'SET_FIELD', field: 'timeLimitMinutes', value: draftQuiz.durationMinutes });
    } else {
      try {
        const saved = sessionStorage.getItem('quizGeneratorFormState_v2');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.timeLimit > 0) {
            dispatch({ type: 'SET_FIELD', field: 'timeLimitMinutes', value: parsed.timeLimit });
          }
        }
      } catch { /* ignore */ }
    }
  }, [draftQuiz]);

  useEffect(() => {
    if (chapterDetail?.stageId && form.stageId !== chapterDetail.stageId) {
      dispatch({ type: 'SET_FIELD', field: 'stageId', value: chapterDetail.stageId });
    }
  }, [chapterDetail?.stageId, form.stageId]);

  const questionTypeCounts = useMemo(
    () => draftQuiz ? computeQuestionTypeCounts(draftQuiz.questions) : {},
    [draftQuiz],
  );

  const totalQuestions = draftQuiz?.questionCount ?? 0;
  const totalPoints = useMemo(
    () => draftQuiz ? computeTotalPoints(draftQuiz.questions) : 0,
    [draftQuiz],
  );

  const difficultyFromStep1 = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('quizGeneratorFormState_v2');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return {
        mode: parsed.difficultyMode as 'uniform' | 'mixed',
        uniform: parsed.difficulty as string,
        mixed: parsed.mixedDifficulty as { easy: number; medium: number; hard: number } | undefined,
      };
    } catch {
      return null;
    }
  }, []);

  const difficultyLabel = useMemo(() => {
    if (!difficultyFromStep1) return '—';
    if (difficultyFromStep1.mode === 'mixed') return t('teacher:quizGenerator.difficultyMixed');
    const key = difficultyFromStep1.uniform;
    if (key === 'easy') return t('teacher:quizGenerator.easy');
    if (key === 'hard') return t('teacher:quizGenerator.hard');
    return t('teacher:quizGenerator.medium');
  }, [difficultyFromStep1, t]);

  const handleStageChange = useCallback((stageId: string) => {
    dispatch({ type: 'SET_FIELD', field: 'stageId', value: stageId });
    dispatch({ type: 'SET_FIELD', field: 'chapterId', value: '' });
    setValidationError('');
  }, []);

  const handleOpenConfirm = useCallback(() => {
    if (!effectiveChapterId) {
      setValidationError(t('teacher:publish.chapterRequired'));
      return;
    }
    setValidationError('');
    dispatch({ type: 'SET_UI_STATE', value: 'confirm-modal' });
  }, [effectiveChapterId, t]);

  const handlePublish = useCallback(async () => {
    if (!quizId) return;
    dispatch({ type: 'SET_UI_STATE', value: 'loading' });

    try {
      await updateQuiz.mutateAsync({
        quizId,
        body: {
          title: form.quizTitle,
          durationMinutes: form.timeLimitMinutes > 0 ? form.timeLimitMinutes : null,
        },
      });
      if (
        effectiveChapterId &&
        effectiveChapterId !== draftQuiz?.chapterId
      ) {
        await assignQuiz.mutateAsync({ quizId, chapterId: effectiveChapterId });
      }
      await publishQuiz.mutateAsync(quizId);
      setTimeout(() => {
        dispatch({ type: 'SET_UI_STATE', value: 'success' });
      }, 2000);
    } catch {
      dispatch({ type: 'SET_UI_STATE', value: 'idle' });
    }
  }, [quizId, effectiveChapterId, form.quizTitle, form.timeLimitMinutes, draftQuiz, updateQuiz, assignQuiz, publishQuiz]);

  if (draftLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col items-center gap-4 py-16">
        <Loader2 size={32} className="animate-spin text-cyan-500" />
        <p className="text-sm text-gray-600">{t('teacher:quizGenerator.loading')}</p>
      </div>
    );
  }

  if (form.uiState === 'success') {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col items-center justify-center gap-6 py-20">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-50">
          <CheckCircle size={40} className="text-success-500" />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-[22px] font-bold text-navy-900">{t('teacher:publish.success.title')}</h2>
          <p className="text-sm text-gray-600">{form.quizTitle}</p>
          <p className="text-sm text-gray-600">{t('teacher:publish.success.message')}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate('/teacher/quizzes')}
            className="min-w-[200px] h-12 rounded-btn font-bold text-white bg-cyan-gradient"
          >
            {t('teacher:publish.success.viewQuizzes')}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/teacher/quizzes/generator')}
            className="min-w-[200px] h-12 rounded-btn font-bold border-cyan-500 text-cyan-500"
          >
            {t('teacher:publish.success.newQuiz')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-6">
      <QuizStepper activeStep={2} />

      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold text-navy-900">
          {t('teacher:publish.pageTitle')}
        </h1>
        <p className="text-sm text-gray-600">
          {hasPresetScope
            ? t('teacher:publish.pageSubtitlePreset')
            : t('teacher:publish.pageSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[60%_40%]">
        {/* ── Left column: form ── */}
        <div className="flex flex-col gap-6">
          {/* Card 1 — Chapter Assignment */}
          <div className="rounded-[14px] bg-white p-6 shadow-card">
            <SectionHead
              icon={<Link size={18} />}
              title={
                hasPresetScope
                  ? t('teacher:publish.chapterAssignmentPreset')
                  : t('teacher:publish.chapterAssignment')
              }
            />

            {hasPresetScope ? (
              <div className="flex flex-col gap-4">
                <p className="font-cairo text-xs text-gray-500">
                  {t('teacher:publish.chapterAssignmentPresetHint')}
                </p>
                <PresetScopeRow label={t('teacher:publish.stage')} value={stageName} />
                <PresetScopeRow label={t('teacher:publish.chapter')} value={chapterName} />
                {scopeLabel && (
                  <PresetScopeRow
                    label={t('teacher:publish.contentScope')}
                    value={scopeLabel}
                    icon={<BookOpen size={14} className="text-cyan-500" />}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-navy-900">
                    {t('teacher:publish.stage')}
                  </label>
                  <select
                    value={form.stageId}
                    onChange={(e) => handleStageChange(e.target.value)}
                    className="h-12 w-full rounded-input border border-gray-300 bg-gray-50 px-4 text-sm outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  >
                    <option value="">{t('teacher:publish.stagePlaceholder')}</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-navy-900">
                    {t('teacher:publish.chapter')}
                  </label>
                  <select
                    value={form.chapterId}
                    onChange={(e) => {
                      dispatch({ type: 'SET_FIELD', field: 'chapterId', value: e.target.value });
                      setValidationError('');
                    }}
                    disabled={!form.stageId}
                    className="h-12 w-full rounded-input border border-gray-300 bg-gray-50 px-4 text-sm outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{t('teacher:publish.chapterPlaceholder')}</option>
                    {chapterOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {validationError && (
                    <p className="text-xs text-danger-500">{validationError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Card 2 — Quiz Settings */}
          <div className="rounded-[14px] bg-white p-6 shadow-card">
            <SectionHead icon={<Settings size={18} />} title={t('teacher:publish.quizSettings')} />

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-navy-900">
                  {t('teacher:publish.titleLabel')}
                </label>
                <input
                  type="text"
                  value={form.quizTitle}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'quizTitle', value: e.target.value })}
                  placeholder={t('teacher:publish.titlePlaceholder')}
                  className="h-12 w-full rounded-input border border-gray-300 bg-gray-50 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-navy-900">
                    {t('teacher:publish.timeLimit')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={180}
                      value={form.timeLimitMinutes || ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const value = raw === '' ? 0 : Math.max(0, Math.min(180, Number(raw)));
                        dispatch({ type: 'SET_FIELD', field: 'timeLimitMinutes', value });
                      }}
                      className="h-12 w-full rounded-input border border-gray-300 bg-gray-50 px-4 text-start text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute inset-y-0 end-0 flex items-center pe-4 text-sm text-gray-500 pointer-events-none">
                      {t('teacher:contentTree.editor.durationUnit')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-navy-900">
                    {t('teacher:publish.passingScore')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.passingScore}
                      onChange={(e) => dispatch({
                        type: 'SET_FIELD',
                        field: 'passingScore',
                        value: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      })}
                      className="h-12 w-full rounded-input border border-gray-300 bg-gray-50 px-4 text-start text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute inset-y-0 end-0 flex items-center pe-4 text-sm text-gray-500 pointer-events-none">%</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{t('teacher:publish.passingScoreHint')}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <ToggleRow
                  checked={form.shuffleQuestions}
                  onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'shuffleQuestions', value: v })}
                  label={t('teacher:publish.shuffleQuestions')}
                />
                <ToggleRow
                  checked={form.shuffleAnswers}
                  onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'shuffleAnswers', value: v })}
                  label={t('teacher:publish.shuffleAnswers')}
                />
                <ToggleRow
                  checked={form.showResultImmediately}
                  onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'showResultImmediately', value: v })}
                  label={t('teacher:publish.showResultImmediately')}
                />
                <ToggleRow
                  checked={form.showCorrectAnswers}
                  onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'showCorrectAnswers', value: v })}
                  label={t('teacher:publish.showCorrectAnswers')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: summary card ── */}
        <div className="self-start md:sticky md:top-6">
          <div className="rounded-[14px] bg-white p-6 shadow-card">
            <SectionHead icon={<FileText size={18} />} title={t('teacher:publish.summaryCard')} />

            <div className="flex flex-col gap-3">
              <SummaryRow
                label={t('teacher:publish.totalQuestions')}
                value={String(totalQuestions)}
              />
              <SummaryRow
                label={t('teacher:publish.totalPoints')}
                value={String(totalPoints)}
              />
              <SummaryRow
                label={t('teacher:publish.duration')}
                value={`${form.timeLimitMinutes} ${t('teacher:contentTree.editor.durationUnit')}`}
              />
              <SummaryRow
                label={t('teacher:publish.difficulty')}
                value={difficultyLabel}
              />
              {hasPresetScope && scopeLabel && (
                <SummaryRow
                  label={t('teacher:publish.contentScope')}
                  value={scopeLabel}
                />
              )}
            </div>

            <hr className="my-4 border-gray-200" />

            {/* Difficulty breakdown — from Step 1 session data */}
            {difficultyFromStep1?.mode === 'mixed' && difficultyFromStep1.mixed && (
              <div className="mb-4 flex flex-col gap-1.5 text-sm">
                <p className="text-xs font-medium text-gray-600 mb-1">{t('teacher:quizGenerator.difficultyMixed')}</p>
                <p className="flex justify-between">
                  <span className="text-gray-600">{t('teacher:quizGenerator.easy')}</span>
                  <span className="text-success-500 font-medium">{difficultyFromStep1.mixed.easy}%</span>
                </p>
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div className="h-1.5 rounded-full bg-success-500" style={{ width: `${difficultyFromStep1.mixed.easy}%` }} />
                </div>
                <p className="flex justify-between mt-1">
                  <span className="text-gray-600">{t('teacher:quizGenerator.medium')}</span>
                  <span className="text-warning-500 font-medium">{difficultyFromStep1.mixed.medium}%</span>
                </p>
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div className="h-1.5 rounded-full bg-warning-500" style={{ width: `${difficultyFromStep1.mixed.medium}%` }} />
                </div>
                <p className="flex justify-between mt-1">
                  <span className="text-gray-600">{t('teacher:quizGenerator.hard')}</span>
                  <span className="text-danger-500 font-medium">{difficultyFromStep1.mixed.hard}%</span>
                </p>
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div className="h-1.5 rounded-full bg-danger-500" style={{ width: `${difficultyFromStep1.mixed.hard}%` }} />
                </div>
              </div>
            )}

            <hr className="my-4 border-gray-200" />

            {Object.entries(questionTypeCounts).length > 0 && (
              <>
                <div className="flex flex-col gap-2">
                  {Object.entries(questionTypeCounts).map(([type, count]) => {
                    const pct = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0;
                    const labelKey = type === 'MCQ'
                      ? 'teacher:publish.questionType.mcq'
                      : type === 'TF'
                        ? 'teacher:publish.questionType.tf'
                        : 'teacher:publish.questionType.short';
                    return (
                      <div key={type} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>{t(labelKey)}</span>
                          <span>{count}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-cyan-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <hr className="my-4 border-gray-200" />
              </>
            )}

            <button
              type="button"
              onClick={() => navigate(`/teacher/quizzes/generator/review/${quizId}`)}
              className="mt-4 text-xs text-cyan-500 hover:underline"
            >
              {t('teacher:publish.backToReview')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom navigation bar ── */}
      <div className="sticky bottom-0 z-20 -mx-1 mt-4 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-1 py-3 backdrop-blur">
        <Button
          variant="ghost"
          onClick={() => navigate(`/teacher/quizzes/generator/review/${quizId}`)}
        >
          <BackArrow size={18} />
          {t('teacher:publish.bottomBack')}
        </Button>
        <Button
          onClick={handleOpenConfirm}
          disabled={isPublishDisabled}
          className={cn(
            'min-w-[200px] h-12 rounded-btn font-bold text-white bg-cyan-gradient',
            isPublishDisabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {t('teacher:publish.publishBtn')}
        </Button>
      </div>

      {/* ── Confirm publish modal ── */}
      <Modal
        isOpen={form.uiState === 'confirm-modal' || form.uiState === 'loading'}
        onClose={() => dispatch({ type: 'SET_UI_STATE', value: 'idle' })}
        size="sm"
      >
        {form.uiState === 'loading' ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 size={40} className="animate-spin text-cyan-500" />
            <p className="text-sm text-gray-600">{t('teacher:publish.confirmModal.loading')}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-cyan-gradient" />
              <div className="flex flex-col items-center gap-1 text-center">
                <h3 className="text-lg font-bold text-navy-900">
                  {t('teacher:publish.confirmModal.title')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('teacher:publish.confirmModal.message', { chapter: publishedChapterLabel })}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[10px] bg-gray-200 p-3">
              <p className="text-sm font-medium text-navy-900">{publishedChapterLabel}</p>
              {scopeLabel && (
                <p className="mt-1 text-xs text-gray-600">{scopeLabel}</p>
              )}
              <p className="text-xs text-gray-600">
                {t('teacher:publish.confirmModal.questionsCount', { count: totalQuestions })} — {t('teacher:publish.confirmModal.pointsCount', { count: totalPoints })}
              </p>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-[8px] bg-warning-50 p-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning-500" />
              <p className="text-xs text-warning-600">{t('teacher:publish.confirmModal.warning')}</p>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                onClick={() => dispatch({ type: 'SET_UI_STATE', value: 'idle' })}
                className="flex-1"
              >
                {t('teacher:publish.confirmModal.reviewBtn')}
              </Button>
              <Button
                onClick={handlePublish}
                className="flex-1 bg-cyan-gradient text-white font-bold"
              >
                {t('teacher:publish.confirmModal.confirmBtn')}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Loading overlay (behind modal) ── */}
      {form.uiState === 'loading' && (
        <div className="fixed inset-0 z-[199] bg-white/60" />
      )}
    </div>
  );
}

function PresetScopeRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold text-navy-900">
        {icon}
        {value}
      </span>
    </div>
  );
}

function ToggleRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-[22px] w-11 shrink-0 cursor-pointer rounded-full transition-colors',
          checked ? 'bg-cyan-500' : 'bg-gray-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all',
            checked ? 'start-[23px]' : 'start-[2.5px]',
          )}
        />
      </div>
      <span className="text-sm text-gray-700 select-none">{label}</span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-navy-900">{value}</span>
    </div>
  );
}
