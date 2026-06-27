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
import { quizApi, mapApiQuestion, mapMetaFromAttempt } from '@/features/student/api/quiz';
import type { PageStatus, QuizQuestion, QuizMeta } from '@/shared/types';
import type { ApiError } from '@/shared/lib/api/client';

export function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { i18n, t } = useTranslation();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timerSeconds, setTimerSeconds] = useState<number>(1800);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [pulsingErrors, setPulsingErrors] = useState<Set<string>>(new Set());
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [meta, setMeta] = useState<QuizMeta | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const timerWarning = timerSeconds < 300;

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

  const setAnswer = useCallback((id: string, value: string) => {
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
  }, []);

  useEffect(() => {
    if (!quizId) return;

    quizApi
      .startAttempt(quizId)
      .then((res) => {
        const data = res.data.data;
        setAttemptId(data.attemptId);

        const totalSec = (data.durationMinutes ?? 30) * 60;
        const elapsed = Math.floor(
          (Date.now() - new Date(data.startedAt).getTime()) / 1000,
        );
        setTimerSeconds(Math.max(totalSec - elapsed, 0));

        const mapped = data.questions.map((q, i) => mapApiQuestion(q, i, i18n.language));
        setQuestions(mapped);

        const mappedMeta = mapMetaFromAttempt(data);
        if (data.quiz.description) {
          mappedMeta.chapterLabel = data.quiz.description;
        }
        setMeta(mappedMeta);

        setStatus('active');
      })
      .catch((err: ApiError) => {
        if (err.statusCode === 409) {
          navigate(`/student/quizzes/${quizId}/results`, { replace: true });
        } else {
          setStatus('error-403');
        }
      });
  }, [quizId, i18n.language]);

  useEffect(() => {
    if (status !== 'active') return;

    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  useEffect(() => {
    if (timerSeconds === 0 && status === 'active') {
      if (attemptId) handleAutoSubmit();
    }
  }, [timerSeconds, status, attemptId]);

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

  const submitAnswers = useCallback(() => {
    if (!attemptId || !quizId) return;

    const answerArray = Object.entries(answers)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([questionId, answer]) => ({ questionId, answer }));

    quizApi
      .submitAttempt(attemptId, answerArray)
      .then(() => {
        navigate(`/student/quizzes/${quizId}/results`, { replace: true });
      })
      .catch(() => {
        setIsSubmitting(false);
        dispatch(addToast({ type: 'error', message: t('common:error', { defaultValue: 'حدث خطأ، حاول مرة أخرى' }) }));
      });
  }, [attemptId, quizId, answers, navigate, dispatch, t]);

  const handleAutoSubmit = useCallback(() => {
    setIsSubmitting(true);
    submitAnswers();
  }, [submitAnswers]);

  const handleOpenModal = useCallback(() => {
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
  }, [answers, questions]);

  const handleDismissModal = useCallback(() => {
    setSubmitModalOpen(false);
    setValidationErrors(new Set());
    setPulsingErrors(new Set());
    setShowValidationBanner(false);
  }, []);

  const handleConfirmSubmit = useCallback(() => {
    setIsSubmitting(true);
    submitAnswers();
  }, [submitAnswers]);

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
            onClick={() => navigate(`/student/quizzes/${quizId}/results`)}
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
        timerSeconds={timerSeconds}
        timerWarning={timerWarning}
        onEndExam={handleEndExam}
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
            />
          ))}

          <SubmitSectionCard
            answeredCount={answeredCount}
            totalCount={questions.length}
            onOpenModal={handleOpenModal}
          />
        </div>
      </main>

      <MobileStickySubmitBar
        answeredCount={answeredCount}
        totalCount={questions.length}
        onOpenModal={handleOpenModal}
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
