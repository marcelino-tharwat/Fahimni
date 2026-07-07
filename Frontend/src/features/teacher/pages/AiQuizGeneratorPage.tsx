import { useState, useCallback, useReducer, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import {
  BrainCircuit, BookOpen, ListChecks, Gauge, Minus, Plus, AlertCircle, AlertTriangle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';
import {
  useStagesList,
  useChaptersByStage,
  useLessonsByChapter,
  useGenerateQuiz,
} from '@/features/teacher/hooks/useQuizGeneration';
import {
  QuizStepper,
  ContentSelector,
  QuestionTypeCards,
  DifficultySelector,
} from '@/features/teacher/components/quiz-generator';
import { ContentIndexingDialog } from '@/features/teacher/components/quiz-generator/ContentIndexingDialog';
import type { QuizGeneratorFormState } from '@/features/teacher/types/quizGeneration';
import { resolveQuizGenerationError } from '@/features/teacher/lib/quizGenerationErrors';
import {
  validateQuizGeneratorDifficulty,
} from '@/features/teacher/lib/quizDifficultyValidation';
import { buildGenerateQuizPayload } from '@/features/teacher/lib/quizGeneratorPayload';
import { buildMetadataMap } from '@/features/teacher/lib/quizReview';
import { saveGeneratedMeta } from '@/features/teacher/lib/quizGeneratedMeta';

const SESSION_KEY = 'quizGeneratorFormState_v2';

const DEFAULT_FORM: QuizGeneratorFormState = {
  stageId: '',
  chapterId: '',
  sourceScope: 'SINGLE_CHAPTER',
  chapterIds: [],
  contentScope: 'CHAPTER',
  lessonIds: [],
  title: '',
  questionCount: 0,
  timeLimit: 0,
  questionTypes: [],
  difficultyMode: 'uniform',
  difficulty: '',
  mixedDifficulty: { easy: 33, medium: 34, hard: 33 },
};

type Action =
  | { type: 'SET_FIELD'; field: keyof QuizGeneratorFormState; value: unknown }
  | { type: 'SET_MIXED_DIFFICULTY'; value: QuizGeneratorFormState['mixedDifficulty'] }
  | { type: 'RESET' };

function formReducer(state: QuizGeneratorFormState, action: Action): QuizGeneratorFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value as never };
    case 'SET_MIXED_DIFFICULTY':
      return { ...state, mixedDifficulty: action.value };
    case 'RESET':
      return DEFAULT_FORM;
    default:
      return state;
  }
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="text-text-secondary">{icon}</span>
      <h3 className="font-cairo text-base font-bold text-text-primary">{title}</h3>
    </div>
  );
}

function FormDivider() {
  return <hr className="border-gray-100 my-6" />;
}

export function AiQuizGeneratorPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [form, dispatch] = useReducer(formReducer, DEFAULT_FORM, (initial) => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? (JSON.parse(saved) as QuizGeneratorFormState) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(form));
  }, [form]);

  const { data: stages = [], isLoading: stagesLoading, isError: stagesIsError, refetch: refetchStages } = useStagesList();
  const { data: chapters = [], isLoading: chaptersLoading, isError: chaptersIsError, refetch: refetchChapters } = useChaptersByStage(form.stageId);
  const { data: lessons = [], isLoading: lessonsLoading, isError: lessonsIsError, refetch: refetchLessons } = useLessonsByChapter(form.chapterId);
  const generateQuiz = useGenerateQuiz();

  const { data: subscriptionData } = useQuery({
    queryKey: ['teacher', 'subscription', 'me'],
    queryFn: () => teacherPlansApi.getMySubscription(),
    staleTime: 60_000,
  });

  const quotaExhausted = subscriptionData
    ? subscriptionData.usage.aiQuizGenerations.remaining <= 0
    : false;

  const generationError = useMemo(() => {
    if (!generateQuiz.isError || !generateQuiz.error) return null;
    return resolveQuizGenerationError(generateQuiz.error, t, i18n.language);
  }, [generateQuiz.isError, generateQuiz.error, t, i18n.language]);

  const setField = useCallback(<K extends keyof QuizGeneratorFormState>(field: K, value: QuizGeneratorFormState[K]) => {
    dispatch({ type: 'SET_FIELD', field, value } as Action);
  }, []);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [indexOpen, setIndexOpen] = useState(false);
  // Lessons to offer for indexing: the explicitly selected ones, or all of the
  // chapter when none are individually selected.
  const lessonsToIndex =
    form.contentScope === 'SELECTED_LESSONS' && form.lessonIds.length > 0
      ? lessons.filter((l) => form.lessonIds.includes(l.id))
      : lessons;

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!form.stageId) errs.stageId = t('teacher:quizGenerator.validationStage');
    const scope = form.sourceScope ?? 'SINGLE_CHAPTER';
    if (scope === 'SINGLE_CHAPTER') {
      if (!form.chapterId) errs.chapterId = t('teacher:quizGenerator.validationChapter');
      if (form.contentScope === 'SELECTED_LESSONS' && form.lessonIds.length === 0) {
        errs.lessonIds = t('teacher:quizGenerator.validationLessons');
      }
    } else if (scope === 'MULTI_CHAPTER') {
      if (new Set(form.chapterIds).size < 2) {
        errs.chapterIds = t('teacher:quizGenerator.validationMultiChapters');
      }
    }
    // FULL_CURRICULUM only needs a stage, already validated above.
    if (form.questionTypes.length === 0) errs.questionTypes = t('teacher:quizGenerator.validationQuestionType');
    if (form.questionCount < 1) errs.questionCount = t('teacher:quizGenerator.requiredQuestionCount');
    Object.assign(errs, validateQuizGeneratorDifficulty(form, t));
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, t]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    generateQuiz.reset();
    const payload = buildGenerateQuizPayload(form);
    try {
      const result = await generateQuiz.mutateAsync(payload);
      // Teacher-only metadata (difficulty + source lesson/chapter) is not
      // persisted server-side, so carry it to Step 2 via nav state and stash it
      // in sessionStorage as a refresh-safe fallback.
      const metadata = buildMetadataMap(result.questions);
      saveGeneratedMeta(result.id, metadata);
      navigate(`/teacher/quizzes/generator/review/${result.id}`, {
        state: { generatedMeta: metadata },
      });
    } catch {
      // Error surfaced via generationError banner below.
    }
  }, [form, validate, generateQuiz, navigate]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 bg-background min-h-screen py-8 px-4">
      <div className="flex items-start gap-3">
        <span className="flex w-11 h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-white">
          <BrainCircuit size={22} />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="font-cairo text-2xl font-extrabold text-text-primary">
            {t('teacher:quizGenerator.title')}
          </h1>
          <p className="font-cairo text-sm text-text-secondary">
            {t('teacher:quizGenerator.subtitle')}
          </p>
        </div>
      </div>

      <QuizStepper activeStep={0} />

      {quotaExhausted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="font-cairo text-sm font-bold text-amber-800">
                {t('teacher:quizGenerator.quotaExhaustedTitle')}
              </p>
              <p className="font-cairo text-sm text-amber-700">
                {t('teacher:quizGenerator.quotaExhaustedDetails')}
              </p>
            </div>
          </div>
        </div>
      )}

      {generationError && (
        <div
          role="alert"
          className="rounded-xl border border-danger-200 bg-danger-50 p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-danger-600" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="font-cairo text-sm font-bold text-danger-800">
                {generationError.title}
              </p>
              {generationError.details && (
                <p className="font-cairo text-sm text-danger-700">
                  {generationError.details}
                </p>
              )}
              {generationError.suggestion && (
                <p className="font-cairo text-xs text-danger-600">
                  {generationError.suggestion}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => generateQuiz.reset()}
              className="shrink-0 font-cairo text-xs font-medium text-danger-700 underline hover:no-underline"
            >
              {t('teacher:quizGenerator.generationErrorDismiss')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <SectionHead icon={<BookOpen size={18} />} title={t('teacher:quizGenerator.contentSelection')} />

        <ContentSelector
          stageId={form.stageId}
          chapterId={form.chapterId}
          sourceScope={form.sourceScope}
          chapterIds={form.chapterIds}
          contentScope={form.contentScope}
          lessonIds={form.lessonIds}
          onSourceScopeChange={(scope) => {
            setField('sourceScope', scope);
            // Reset scope-specific selections so a switch never carries stale IDs.
            setField('chapterId', '');
            setField('chapterIds', []);
            setField('lessonIds', []);
            setField('contentScope', 'CHAPTER');
          }}
          onChaptersChange={(ids) => setField('chapterIds', ids)}
          onStageChange={(id) => {
            setField('stageId', id);
            setField('chapterId', '');
            setField('chapterIds', []);
            setField('lessonIds', []);
          }}
          onChapterChange={(id) => {
            setField('chapterId', id);
            setField('lessonIds', []);
          }}
          onContentScopeChange={(scope) => {
            setField('contentScope', scope);
            if (scope === 'CHAPTER') {
              setField('lessonIds', []);
            }
          }}
          onLessonsChange={(ids) => setField('lessonIds', ids)}
          stages={stages}
          chapters={chapters}
          lessons={lessons}
          stagesLoading={stagesLoading}
          stagesError={stagesIsError ? t('teacher:quizGenerator.errorLoadStages') : null}
          chaptersLoading={chaptersLoading}
          chaptersError={chaptersIsError ? t('teacher:quizGenerator.errorLoadChapters') : null}
          lessonsLoading={lessonsLoading}
          lessonsError={lessonsIsError ? t('teacher:quizGenerator.errorLoadLessons') : null}
          onRetryStages={() => refetchStages()}
          onRetryChapters={() => refetchChapters()}
          onRetryLessons={() => refetchLessons()}
        />
        {errors.lessonIds && (
          <p className="font-cairo text-xs text-danger-500">{errors.lessonIds}</p>
        )}
        {errors.chapterIds && (
          <p className="font-cairo text-xs text-danger-500">{errors.chapterIds}</p>
        )}

        <div className="mt-3 flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIndexOpen(true)}
            disabled={!form.chapterId || lessons.length === 0}
          >
            {t('teacher:quizGenerator.indexing.button')}
          </Button>
          <span className="font-cairo text-xs text-text-secondary">
            {t('teacher:quizGenerator.indexing.hint')}
          </span>
        </div>

        <ContentIndexingDialog
          isOpen={indexOpen}
          onClose={() => setIndexOpen(false)}
          lessons={lessonsToIndex}
        />

        <FormDivider />

        <SectionHead icon={<ListChecks size={18} />} title={t('teacher:quizGenerator.quizSettings')} />

        <div className="flex flex-col gap-4">
          <QuestionTypeCards
            selected={form.questionTypes}
            onChange={(types) => setField('questionTypes', types)}
          />
          {errors.questionTypes && (
            <p className="flex items-center gap-1 font-cairo text-xs text-danger">
              <AlertCircle size={11} />
              {errors.questionTypes}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="font-cairo text-sm font-medium text-text-primary">
                {t('teacher:quizGenerator.questionCount')}
              </label>
              <div className="flex h-[48px] items-center gap-0 overflow-hidden rounded-input border border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setField('questionCount', Math.max(0, form.questionCount - 1))}
                  className="flex h-full w-12 shrink-0 items-center justify-center text-text-secondary hover:bg-gray-100 border-e border-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={form.questionCount <= 0}
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  min={0}
                  value={form.questionCount}
                  onChange={(e) => setField('questionCount', Math.max(0, Number(e.target.value) || 0))}
                  className="h-full w-full flex-1 border-0 bg-transparent text-center font-cairo text-base font-medium text-navy-800 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setField('questionCount', form.questionCount + 1)}
                  className="flex h-full w-12 shrink-0 items-center justify-center text-text-secondary hover:bg-gray-100 border-s border-gray-200"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-cairo text-sm font-medium text-text-primary">
                {t('teacher:quizGenerator.timeLimit')}
              </label>
              <div className="flex h-[48px] items-center gap-0 overflow-hidden rounded-input border border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setField('timeLimit', Math.max(0, form.timeLimit - 1))}
                  className="flex h-full w-12 shrink-0 items-center justify-center text-text-secondary hover:bg-gray-100 border-e border-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={form.timeLimit <= 0}
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  min={0}
                  value={form.timeLimit}
                  onChange={(e) => setField('timeLimit', Math.max(0, Number(e.target.value) || 0))}
                  className="h-full w-full flex-1 border-0 bg-transparent text-center font-cairo text-base font-medium text-navy-800 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setField('timeLimit', form.timeLimit + 1)}
                  className="flex h-full w-12 shrink-0 items-center justify-center text-text-secondary hover:bg-gray-100 border-s border-gray-200"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <FormDivider />

        <SectionHead icon={<Gauge size={18} />} title={t('teacher:quizGenerator.difficulty')} />

        <DifficultySelector
          mode={form.difficultyMode}
          uniformValue={form.difficulty}
          mixedValue={form.mixedDifficulty}
          onModeChange={(mode) => {
            setField('difficultyMode', mode);
            if (mode === 'mixed') {
              setField('difficulty', '');
            }
            setErrors((prev) => {
              const next = { ...prev };
              delete next.difficulty;
              delete next.mixedDifficulty;
              return next;
            });
          }}
          onUniformChange={(val) => {
            setField('difficulty', val);
            setErrors((prev) => {
              const next = { ...prev };
              delete next.difficulty;
              return next;
            });
          }}
          onMixedChange={(val) => {
            dispatch({ type: 'SET_MIXED_DIFFICULTY', value: val });
            setErrors((prev) => {
              const next = { ...prev };
              delete next.mixedDifficulty;
              return next;
            });
          }}
        />
        {errors.difficulty && (
          <p className="flex items-center gap-1 font-cairo text-xs text-danger mt-2">
            <AlertCircle size={11} />
            {errors.difficulty}
          </p>
        )}
        {errors.mixedDifficulty && (
          <p className="flex items-center gap-1 font-cairo text-xs text-danger mt-2">
            <AlertCircle size={11} />
            {errors.mixedDifficulty}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-start gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/teacher/dashboard')}
            className="h-11 px-5 rounded-xl text-sm font-medium"
          >
            {t('teacher:quizGenerator.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={generateQuiz.isPending}
            disabled={quotaExhausted}
            className="min-w-[200px] h-12 px-8 gap-2.5 transition-all duration-200 bg-[linear-gradient(135deg,#00C9DB,#0EA5E9)] text-white font-bold text-base rounded-full active:scale-[0.98] disabled:opacity-90 shadow-[0_8px_24px_-6px_rgba(0,201,219,0.5)] hover:shadow-[0_0_20px_rgba(0,201,219,0.6),0_8px_24px_-6px_rgba(0,201,219,0.5)]"
          >
            {generateQuiz.isPending ? t('teacher:quizGenerator.generating') : t('teacher:quizGenerator.generateBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
}
