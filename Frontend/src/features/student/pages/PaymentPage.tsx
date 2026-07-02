import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { useStudentTree } from '@/features/student/hooks/useStudentContent';
import { usePaymentStatusPolling } from '@/shared/hooks/usePaymentStatusPolling';
import type { StudentContentTreeItem } from '@/features/student/types/studentContent';
import type { RedeemResult } from '@/shared/types';
import {
  AlreadyEnrolledView,
  ChapterInfoCard,
  PaymobCard,
  PromoCodeCard,
  SecureFooter,
  type ChapterData,
} from '@/features/student/components/payment';

const PENDING_STORAGE_KEY = 'pending_payment';
const STALE_TTL_MS = 5 * 60 * 1000; // 5 minutes — well above the 120s polling timeout

interface PendingPayment {
  orderId: string;
  chapterId: string;
  startedAt?: number;
}

function findChapter(tree: StudentContentTreeItem[], chapterId: string): ChapterData | null {
  for (const item of tree) {
    const found = item.chapters.find((c) => c.chapter.id === chapterId);
    if (found) {
      return {
        id: found.chapter.id,
        name: found.chapter.name,
        description: found.chapter.description,
        price: found.chapter.price,
        lessonCount: found.chapter.lessonCount,
        stageName: item.stage.name,
        enrollmentStatus: found.chapter.enrollmentStatus,
        firstLessonId: found.lessons[0]?.id ?? null,
      };
    }
  }
  return null;
}

export function PaymentPage() {
  const { t } = useTranslation();
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, isLoading, isError, refetch, isFetching } = useStudentTree();

  const [pendingOrderId, setPendingOrderId] = useState<string | null>(() => {
    if (!chapterId) return null;
    try {
      const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
      if (!raw) return null;
      const pending = JSON.parse(raw) as PendingPayment;
      if (
        pending.startedAt &&
        Date.now() - pending.startedAt > STALE_TTL_MS
      ) {
        sessionStorage.removeItem(PENDING_STORAGE_KEY);
        return null;
      }
      return pending.chapterId === chapterId ? pending.orderId : null;
    } catch {
      sessionStorage.removeItem(PENDING_STORAGE_KEY);
      return null;
    }
  });

  const enrolledOnLoad = useRef<boolean | null>(null);

  const chapter = data && chapterId ? findChapter(data, chapterId) : null;
  if (chapter && enrolledOnLoad.current === null) {
    enrolledOnLoad.current = chapter.enrollmentStatus === 'purchased';
  }

  const goToCourse = useCallback(() => {
    if (chapter?.firstLessonId) {
      navigate(`/student/lessons/${chapter.firstLessonId}`);
      return;
    }
    // Enrolled, but the chapter has no lessons yet (empty chapter, or a race
    // against stale tree data). Never route to a non-existent lesson URL —
    // land on the dashboard and tell the student lessons are on the way.
    dispatch(addToast({ type: 'success', message: t('student:content.enrolledButEmpty') }));
    navigate('/student/dashboard');
  }, [chapter, navigate, dispatch, t]);

  const handleRetry = useCallback(() => {
    sessionStorage.removeItem(PENDING_STORAGE_KEY);
    setPendingOrderId(null);
  }, []);

  const { status, checkStatus } = usePaymentStatusPolling(
    pendingOrderId,
    () => {
      sessionStorage.removeItem(PENDING_STORAGE_KEY);
      setPendingOrderId(null);
      refetch();
    },
    () => {
      sessionStorage.removeItem(PENDING_STORAGE_KEY);
      setPendingOrderId(null);
    },
  );

  // --- Loading / Error / NotFound ---
  if (isLoading) return <PaymentLoading />;
  if (isError) return <PaymentError onRetry={() => refetch()} retrying={isFetching} />;
  if (!chapter) return <ChapterNotFound onBack={() => navigate('/student/dashboard')} />;

  // --- Already enrolled (from initial load) ---
  if (enrolledOnLoad.current) {
    return <AlreadyEnrolledView chapter={chapter} onGoToCourse={goToCourse} />;
  }

  // --- Payment-flow states ---
  if (status === 'confirming') {
    return (
      <ConfirmingPayment
        chapter={chapter}
        onRetry={handleRetry}
      />
    );
  }

  if (status === 'success') {
    return (
      <PaymentSuccess
        chapter={chapter}
        onGoToCourse={goToCourse}
      />
    );
  }

  if (status === 'failed') {
    return (
      <PaymentFailed
        chapter={chapter}
        onRetry={handleRetry}
      />
    );
  }

  if (status === 'timeout') {
    return (
      <PaymentTimeout
        chapter={chapter}
        onCheckStatus={checkStatus}
        onRetry={handleRetry}
      />
    );
  }

  const handleSuccess = (_result: RedeemResult) => {
    dispatch(addToast({ type: 'success', message: t('student:payment.successToast') }));
    goToCourse();
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate('/student/dashboard')}
        className="flex w-fit items-center gap-1.5 font-cairo text-sm text-gray-600 transition-opacity hover:opacity-70"
      >
        <ChevronRight size={14} />
        {t('student:payment.backToContent')}
      </button>

      <ChapterInfoCard chapter={chapter} dimmed={false} />

      <div>
        <p className="mb-3 font-cairo text-base font-semibold text-navy-800">
          {t('student:payment.chooseMethod')}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PaymobCard price={chapter.price} chapterId={chapter.id} />
          <PromoCodeCard chapterId={chapter.id} onSuccess={handleSuccess} />
        </div>
      </div>

      <SecureFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  States                                                             */
/* ------------------------------------------------------------------ */

function PaymentLoading() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[640px] items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-cyan-500" />
    </div>
  );
}

function PaymentError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-3 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
        <AlertCircle size={32} className="text-danger-500" />
      </span>
      <h3 className="font-cairo text-lg font-bold text-navy-800">
        {t('student:payment.loadError')}
      </h3>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="mt-2 flex h-11 items-center justify-center gap-2 rounded-input bg-navy-800 px-6 font-cairo text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:opacity-60"
      >
        <RefreshCw size={16} className={cn(retrying && 'animate-spin')} />
        {t('student:payment.retry')}
      </button>
    </div>
  );
}

function ChapterNotFound({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-3 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
        <AlertCircle size={32} className="text-gray-500" />
      </span>
      <h3 className="font-cairo text-lg font-bold text-navy-800">
        {t('student:payment.notFound.title')}
      </h3>
      <p className="font-cairo text-sm text-gray-600">
        {t('student:payment.notFound.description')}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 h-11 rounded-input bg-cyan-gradient px-6 font-cairo text-sm font-bold text-white"
      >
        {t('student:payment.backToContent')}
      </button>
    </div>
  );
}

/* ---------- Payment flow sub-states ---------- */

function ConfirmingPayment({
  chapter,
  onRetry,
}: {
  chapter: ChapterData;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <ChapterInfoCard chapter={chapter} dimmed />
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <Loader2 size={40} className="animate-spin text-cyan-500" />
        <div>
          <p className="font-cairo text-lg font-semibold text-navy-800">
            {t('student:payment.confirming.title')}
          </p>
          <p className="mt-1 font-cairo text-sm text-gray-600">
            {t('student:payment.confirming.description')}
          </p>
          <p className="mt-3 font-cairo text-xs text-gray-400">
            {t('student:payment.confirming.doNotClose')}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-11 rounded-input border border-gray-300 bg-white px-6 font-cairo text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t('student:payment.failedRetry.retryButton')}
        </button>
      </div>
    </div>
  );
}

function PaymentSuccess({
  chapter,
  onGoToCourse,
}: {
  chapter: ChapterData;
  onGoToCourse: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <ChapterInfoCard chapter={chapter} />
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-success-500/30 bg-success-500/10">
          <CheckCircle size={36} className="text-success-500" />
        </div>
        <div>
          <p className="font-cairo text-lg font-semibold text-navy-800">
            ✓ {t('student:payment.alreadyEnrolled.title')}
          </p>
          <p className="mt-1 font-cairo text-sm text-gray-600">
            {t('student:payment.alreadyEnrolled.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToCourse}
          className="h-11 rounded-input bg-cyan-gradient px-8 font-cairo text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {t('student:payment.alreadyEnrolled.goToCourse')}
        </button>
      </div>
    </div>
  );
}

function PaymentFailed({
  chapter,
  onRetry,
}: {
  chapter: ChapterData;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <ChapterInfoCard chapter={chapter} />
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
          <AlertCircle size={32} className="text-danger-500" />
        </span>
        <div>
          <p className="font-cairo text-lg font-semibold text-navy-800">
            {t('student:payment.failedRetry.title')}
          </p>
          <p className="mt-1 font-cairo text-sm text-gray-600">
            {t('student:payment.failedRetry.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 h-11 rounded-input bg-cyan-gradient px-8 font-cairo text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {t('student:payment.failedRetry.retryButton')}
        </button>
      </div>
    </div>
  );
}

function PaymentTimeout({
  chapter,
  onCheckStatus,
  onRetry,
}: {
  chapter: ChapterData;
  onCheckStatus: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <ChapterInfoCard chapter={chapter} />
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
          <AlertCircle size={32} className="text-amber-500" />
        </span>
        <div>
          <p className="font-cairo text-lg font-semibold text-navy-800">
            {t('student:payment.stillProcessing.title')}
          </p>
          <p className="mt-1 font-cairo text-sm text-gray-600">
            {t('student:payment.stillProcessing.description')}
          </p>
        </div>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onCheckStatus}
            className="h-11 rounded-input bg-cyan-gradient px-6 font-cairo text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            {t('student:payment.checkStatus')}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="h-11 rounded-input border border-gray-300 bg-white px-6 font-cairo text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t('student:payment.failedRetry.retryButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
