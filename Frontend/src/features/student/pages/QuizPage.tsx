import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/shared/components/ui';
import { addToast } from '@/shared/store/slices/toastSlice';
import { useAppDispatch } from '@/shared/store/hooks';
import { Lock, ClipboardCheck } from 'lucide-react';
import {
  ExamTopbar,
  QuizHeaderCard,
  ProgressAndNavigatorCard,
  QuestionCard,
  SubmitSectionCard,
  MobileStickySubmitBar,
  SubmitModal,
} from '@/features/student/components/quiz';
import {
  quizApi,
  mapApiQuestion,
  mapMetaFromAttempt,
  buildQuizResults,
  buildDraftAnswers,
  buildSubmitAnswers,
  getAttemptResults,
} from '@/features/student/api/quiz';
import { useQuizAttemptTimer } from '@/features/student/hooks/useQuizAttemptTimer';
import type { PageStatus, QuizQuestion, QuizMeta } from '@/shared/types';
import type { ApiError } from '@/shared/lib/api/client';

type AutoSubmitState = 'idle' | 'submitting' | 'retrying';

const DRAFT_SAVE_DEBOUNCE_MS = 800;

export function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { i18n, t } = useTranslation();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<PageStatus>('loading');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSubmitState, setAutoSubmitState] = useState<AutoSubmitState>('idle');
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [pulsingErrors, setPulsingErrors] = useState<Set<string>>(new Set());
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [meta, setMeta] = useState<QuizMeta | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [inputsLocked, setInputsLocked] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const finalizeInFlightRef = useRef(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRef = useRef<{ questionId: string; answer: string }[] | null>(null);
  const questionsRef = useRef<QuizQuestion[]>([]);
  const answersRef = useRef<Record<string, string>>({});

  const { remainingSeconds, timerWarning, isExpired, setOnExpire } = useQuizAttemptTimer({
    expiresAt,
    serverTime,
    enabled: status === 'active',
  });

  questionsRef.current = questions;
  answersRef.current = answers;

  const answeredCount = useMemo(
    () => questions.filter((q) => {
      const val = answers[q.id];
      return val !== undefined && val !== '';
    }).length,
    [answers, questions],
  );

  const allAnswered = answeredCount === questions.length;

  const unansweredIds = useMemo(
    () => questions
      .filter((q) => !answers[q.id] || answers[q.id] === '')
      .map((q) => q.id),
    [answers, questions],
  );

  const flushDraftSave = useCallback(async (): Promise<void> => {
    if (!attemptId || inputsLocked) return;
    const payload =
      pendingDraftRef.current ??
      buildDraftAnswers(questionsRef.current, answersRef.current);
    if (payload.length === 0) return;

    pendingDraftRef.current = null;
    try {
      await quizApi.saveDraftAnswers(attemptId, payload);
    } catch {
      pendingDraftRef.current = payload;
    }
  }, [attemptId, inputsLocked]);

  const scheduleDraftSave = useCallback(() => {
    if (!attemptId || inputsLocked) return;
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = setTimeout(() => {
      void flushDraftSave();
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }, [attemptId, inputsLocked, flushDraftSave]);

  const setAnswer = useCallback((id: string, value: string) => {
    if (inputsLocked) return;
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setValidationErrors((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPulsingErrors((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    scheduleDraftSave();
  }, [inputsLocked, scheduleDraftSave]);

  const navigateToResults = useCallback(
    (submitResponse: Awaited<ReturnType<typeof getAttemptResults>>) => {
      if (!quizId) return;
      const resultsData = buildQuizResults(submitResponse);
      navigate(`/student/quizzes/${quizId}/results/${submitResponse.attemptId}`, {
        replace: true,
        state: resultsData,
      });
    },
    [navigate, quizId],
  );

  const finalizeAttempt = useCallback(
    async (mode: 'MANUAL' | 'TIME_EXPIRED') => {
      if (!attemptId || !quizId || finalizeInFlightRef.current) return;
      finalizeInFlightRef.current = true;
      setIsSubmitting(true);
      if (mode === 'TIME_EXPIRED') {
        setAutoSubmitState('submitting');
        setInputsLocked(true);
      }

      try {
        if (draftSaveTimerRef.current) {
          clearTimeout(draftSaveTimerRef.current);
        }
        await flushDraftSave();

        const answerArray =
          mode === 'MANUAL'
            ? buildSubmitAnswers(questionsRef.current, answersRef.current)
            : [];

        const res = await quizApi.submitAttempt(attemptId, answerArray, mode);
        navigateToResults(res.data.data);
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.statusCode === 409 || apiErr.code === 'ATTEMPT_ALREADY_SUBMITTED') {
          try {
            const existing = await getAttemptResults(attemptId);
            navigateToResults(existing);
            return;
          } catch {
            // fall through to retry/error handling
          }
        }

        if (mode === 'TIME_EXPIRED') {
          setAutoSubmitState('retrying');
          finalizeInFlightRef.current = false;
          window.setTimeout(() => {
            void finalizeAttempt('TIME_EXPIRED');
          }, 3000);
          return;
        }

        setIsSubmitting(false);
        finalizeInFlightRef.current = false;
        dispatch(addToast({
          type: 'error',
          message: t('common:error', { defaultValue: 'حدث خطأ، حاول مرة أخرى' }),
        }));
      }
    },
    [attemptId, quizId, flushDraftSave, navigateToResults, dispatch, t],
  );

  useEffect(() => {
    if (!quizId) return;

    quizApi
      .startAttempt(quizId)
      .then((res) => {
        const data = res.data.data;
        setAttemptId(data.attemptId);
        setExpiresAt(data.expiresAt);
        setServerTime(data.serverTime);

        const mapped = data.questions.map((q, i) => mapApiQuestion(q, i, i18n.language));
        setQuestions(mapped);

        const restored: Record<string, string> = {};
        for (const item of data.savedAnswers ?? []) {
          const question = mapped.find((q) => q.id === item.questionId);
          if (!question) continue;
          if (question.type === 'mcq' && question.options?.length) {
            const byText = question.options.find((o) => o.text === item.answer);
            restored[item.questionId] = byText?.id ?? item.answer;
          } else {
            restored[item.questionId] = item.answer;
          }
        }
        setAnswers(restored);

        const mappedMeta = mapMetaFromAttempt(data);
        if (data.quiz.description) {
          mappedMeta.chapterLabel = data.quiz.description;
        }
        setMeta(mappedMeta);
        setStatus('active');
      })
      .catch((err: ApiError) => {
        if (err.statusCode === 409) {
          navigate('/student/quizzes', { replace: true });
        } else {
          setStatus('error-403');
        }
      });
  }, [quizId, i18n.language, navigate]);

  useEffect(() => {
    setOnExpire(() => {
      if (status !== 'active' || !attemptId) return;
      void finalizeAttempt('TIME_EXPIRED');
    });
    return () => setOnExpire(null);
  }, [status, attemptId, setOnExpire, finalizeAttempt]);

  useEffect(() => {
    if (isExpired && status === 'active') {
      setInputsLocked(true);
    }
  }, [isExpired, status]);

  useEffect(() => {
    if (status !== 'active') return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-qid');
            if (id) setCurrentId(id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );

    const cards = document.querySelectorAll('[data-qid]');
    cards.forEach((el) => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [status, questions]);

  useEffect(() => {
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, []);

  const handleOpenModal = useCallback(() => {
    if (inputsLocked) return;
    const unanswered = questions.filter((q) => !answers[q.id] || answers[q.id] === '');
    if (unanswered.length > 0) {
      const errorIds = new Set(unanswered.map((q) => q.id));
      setValidationErrors(errorIds);
      setPulsingErrors(new Set(errorIds));
      setShowValidationBanner(true);

      setTimeout(() => {
        setPulsingErrors(new Set());
      }, 1500);

      const firstUnanswered = unanswered[0];
      document.getElementById(`q-${firstUnanswered.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setSubmitModalOpen(true);
  }, [answers, questions, inputsLocked]);

  const handleDismissModal = useCallback(() => {
    setSubmitModalOpen(false);
    setValidationErrors(new Set());
    setPulsingErrors(new Set());
    setShowValidationBanner(false);
  }, []);

  const handleConfirmSubmit = useCallback(() => {
    void finalizeAttempt('MANUAL');
  }, [finalizeAttempt]);

  const handleScrollToQuestion = useCallback((id: string) => {
    setSubmitModalOpen(false);
    setValidationErrors(new Set());
    setPulsingErrors(new Set());
    setShowValidationBanner(false);
    setTimeout(() => {
      document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const handleEndExam = useCallback(() => {
    handleOpenModal();
  }, [handleOpenModal]);

  const timerStatusLabel =
    autoSubmitState === 'submitting'
      ? t('quiz:autoSubmitting')
      : autoSubmitState === 'retrying'
        ? t('quiz:autoSubmitRetry')
        : undefined;

  if (status === 'loading') {
    return (
      <div dir={i18n.dir()} className="min-h-screen bg-navy-50 font-cairo">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5 sm:px-6">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    );
  }

  if (status === 'error-403') {
    return (
      <div dir={i18n.dir()} className="min-h-screen bg-navy-50 font-cairo">
        <ExamTopbar timerSeconds={0} timerWarning={false} onEndExam={() => {}} />
        <div className="flex flex-col items-center justify-center gap-5 px-6 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-200">
            <Lock size={36} className="text-gray-500" />
          </div>
          <h1 className="text-h3 text-navy-800">{t('quiz:err403Title')}</h1>
          <p className="mt-2 max-w-xs text-body text-gray-600">{t('quiz:err403Msg')}</p>
          <button
            type="button"
            onClick={() => navigate('/student/content')}
            className="h-11 rounded-btn bg-cyan-gradient px-8 text-sm font-bold text-white"
          >
            {t('quiz:browseCourses')}
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error-400') {
    return (
      <div dir={i18n.dir()} className="min-h-screen bg-navy-50 font-cairo">
        <ExamTopbar timerSeconds={0} timerWarning={false} onEndExam={() => {}} />
        <div className="flex flex-col items-center justify-center gap-5 px-6 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-200">
            <ClipboardCheck size={36} className="text-cyan-500" />
          </div>
          <h1 className="text-h3 text-navy-800">{t('quiz:err400Title')}</h1>
          <p className="mt-2 text-body text-gray-600">{t('quiz:err400Msg')}</p>
          <button
            type="button"
            onClick={() => navigate('/student/quizzes')}
            className="h-11 rounded-btn bg-cyan-gradient px-8 text-sm font-bold text-white"
          >
            {t('quiz:viewResults')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir={i18n.dir()} className="min-h-screen bg-navy-50 font-cairo">
      <ExamTopbar
        timerSeconds={remainingSeconds}
        timerWarning={timerWarning}
        onEndExam={handleEndExam}
        timerLabel={timerStatusLabel}
        disableEndExam={inputsLocked || isSubmitting}
      />

      <main className="px-4 py-5 pb-32 sm:px-6 sm:pb-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {meta && <QuizHeaderCard meta={meta} />}

          <ProgressAndNavigatorCard
            questions={questions}
            answers={answers}
            validationErrors={validationErrors}
            showValidationBanner={showValidationBanner}
            currentId={currentId}
          />

          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              answer={answers[q.id] ?? ''}
              onAnswer={setAnswer}
              hasError={validationErrors.has(q.id)}
              isPulsing={pulsingErrors.has(q.id)}
              disabled={inputsLocked}
            />
          ))}

          <SubmitSectionCard
            answeredCount={answeredCount}
            totalCount={questions.length}
            onOpenModal={handleOpenModal}
            disabled={inputsLocked}
          />
        </div>
      </main>

      <MobileStickySubmitBar
        answeredCount={answeredCount}
        totalCount={questions.length}
        onOpenModal={handleOpenModal}
        disabled={inputsLocked}
      />

      <SubmitModal
        open={submitModalOpen}
        isSubmitting={isSubmitting}
        allAnswered={allAnswered}
        totalCount={questions.length}
        unansweredCount={unansweredIds.length}
        unansweredIds={unansweredIds}
        questions={questions}
        onConfirm={handleConfirmSubmit}
        onDismiss={handleDismissModal}
        onScrollToQuestion={handleScrollToQuestion}
      />
    </div>
  );
}
