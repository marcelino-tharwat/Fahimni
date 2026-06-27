import { useState, useCallback, useReducer, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BrainCircuit, BookOpen, ListChecks, Gauge, Minus, Plus, AlertCircle,
} from 'lucide-react';
import { Button } from '@/shared/components/ui';
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
import type { QuizGeneratorFormState, GenerateQuizPayload } from '@/features/teacher/types/quizGeneration';

const SESSION_KEY = 'quizGeneratorFormState_v2';

const DEFAULT_FORM: QuizGeneratorFormState = {
  stageId: '',
  chapterId: '',
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
  const { t } = useTranslation();
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

  const setField = useCallback(<K extends keyof QuizGeneratorFormState>(field: K, value: QuizGeneratorFormState[K]) => {
    dispatch({ type: 'SET_FIELD', field, value } as Action);
  }, []);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!form.stageId) errs.stageId = t('teacher:quizGenerator.validationStage');
    if (!form.chapterId) errs.chapterId = t('teacher:quizGenerator.validationChapter');
    if (form.questionTypes.length === 0) errs.questionTypes = t('teacher:quizGenerator.validationQuestionType');
    if (form.questionCount < 1) errs.questionCount = t('teacher:quizGenerator.requiredQuestionCount');
    if (!form.difficulty) errs.difficulty = t('teacher:quizGenerator.validationDifficulty');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, t]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    const payload: GenerateQuizPayload = {
      chapterId: form.chapterId,
      lessonIds: form.lessonIds.length > 0 ? form.lessonIds : undefined,
      questionCount: form.questionCount,
      types: form.questionTypes as ('MCQ' | 'TF' | 'ESSAY')[],
      difficulty: form.difficulty as 'easy' | 'medium' | 'hard',
    };
    try {
      const result = await generateQuiz.mutateAsync(payload);
      navigate(`/teacher/quizzes/generator/review/${result.id}`);
    } catch {
      /* handled by react-query */
    }
  }, [form, validate, generateQuiz, navigate]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 bg-[#F4F4FA] min-h-screen py-8 px-4">
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

      <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <SectionHead icon={<BookOpen size={18} />} title={t('teacher:quizGenerator.contentSelection')} />

        <ContentSelector
          stageId={form.stageId}
          chapterId={form.chapterId}
          lessonIds={form.lessonIds}
          onStageChange={(id) => {
            setField('stageId', id);
            setField('chapterId', '');
            setField('lessonIds', []);
          }}
          onChapterChange={(id) => {
            setField('chapterId', id);
            setField('lessonIds', []);
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
          onModeChange={(mode) => setField('difficultyMode', mode)}
          onUniformChange={(val) => setField('difficulty', val)}
          onMixedChange={(val) => dispatch({ type: 'SET_MIXED_DIFFICULTY', value: val })}
        />
        {errors.difficulty && (
          <p className="flex items-center gap-1 font-cairo text-xs text-danger mt-2">
            <AlertCircle size={11} />
            {errors.difficulty}
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
            className="min-w-[200px] h-12 px-8 gap-2.5 transition-all duration-200 bg-[linear-gradient(135deg,#00C9DB,#0EA5E9)] text-white font-bold text-base rounded-full active:scale-[0.98] disabled:opacity-90 shadow-[0_8px_24px_-6px_rgba(0,201,219,0.5)] hover:shadow-[0_0_20px_rgba(0,201,219,0.6),0_8px_24px_-6px_rgba(0,201,219,0.5)]"
          >
            {generateQuiz.isPending ? t('teacher:quizGenerator.generating') : t('teacher:quizGenerator.generateBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
}
