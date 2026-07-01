import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from '@/shared/components/ui';
import { StudentHero } from '@/features/student/components/StudentHero';
import { AllContentTree } from '@/features/student/components/AllContentTree';
import { MyCoursesTab } from '@/features/student/components/MyCoursesTab';
import { STUDENT_TREE_KEY, STUDENT_MY_COURSES_KEY } from '@/features/student/hooks/useStudentContent';
import { usePaymentStatusPolling, type PaymentStatus } from '@/shared/hooks/usePaymentStatusPolling';

const PENDING_STORAGE_KEY = 'pending_payment';
const STALE_TTL_MS = 5 * 60 * 1000; // 5 minutes — well above the 120s polling timeout

type TabKey = 'all' | 'courses';

/** Read and validate a pending payment entry from sessionStorage. */
function readPendingPayment(): { orderId: string; chapterId: string } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { orderId: string; chapterId: string; startedAt?: number };
    if (parsed.startedAt && Date.now() - parsed.startedAt > STALE_TTL_MS) {
      sessionStorage.removeItem(PENDING_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(PENDING_STORAGE_KEY);
    return null;
  }
}

/** Fallback: extract Paymob's `order` query param from the URL.  Paymob
 *  preserves its own params during redirect but drops custom ones like
 *  `orderId`, so we use this as a secondary source when sessionStorage
 *  is empty (e.g. first visit after a cold tab open). */
function getOrderIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('order');
}

/**
 * Student landing page (the sidebar "Dashboard" entry). A real-data welcome
 * strip sits above two content tabs backed by the student APIs:
 *   - All Content -> stages/chapters/lessons accordion (AllContentTree)
 *   - My Courses  -> enrolled course cards + an "explore more" section
 *
 * Also handles post-Paymob payment confirmation: when a pending payment
 * exists in sessionStorage (or Paymob's `order` query param is present as
 * fallback), a small inline banner shows polling progress, success, or
 * failure states.
 */
export function StudentDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingFromStorage = readPendingPayment();

  const [pendingOrderId, setPendingOrderId] = useState<string | null>(
    () => pendingFromStorage?.orderId ?? getOrderIdFromUrl() ?? null,
  );

  const [pendingChapterId, setPendingChapterId] = useState<string | null>(
    () => pendingFromStorage?.chapterId ?? null,
  );

  // Clean up Paymob query params from the URL after reading them
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymobKeys = ['order', 'id', 'hmac', 'pending', 'success'];
    const hasPaymobParams = paymobKeys.some((k) => params.has(k));
    if (hasPaymobParams) {
      paymobKeys.forEach((k) => params.delete(k));
      const search = params.toString();
      const newUrl = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, []);

  const handleSuccess = useCallback(() => {
    sessionStorage.removeItem(PENDING_STORAGE_KEY);
    queryClient.invalidateQueries({ queryKey: STUDENT_TREE_KEY });
    queryClient.invalidateQueries({ queryKey: STUDENT_MY_COURSES_KEY });
    autoDismissRef.current = setTimeout(() => {
      setPendingOrderId(null);
      setPendingChapterId(null);
    }, 5000);
  }, [queryClient]);

  const handleFailed = useCallback(() => {
    sessionStorage.removeItem(PENDING_STORAGE_KEY);
  }, []);

  const { status, checkStatus } = usePaymentStatusPolling(
    pendingOrderId,
    handleSuccess,
    handleFailed,
  );

  const dismissBanner = useCallback(() => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    setPendingOrderId(null);
    setPendingChapterId(null);
  }, []);

  const handleRetryPayment = useCallback(() => {
    if (!pendingChapterId) return;
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    sessionStorage.removeItem(PENDING_STORAGE_KEY);
    setPendingOrderId(null);
    setPendingChapterId(null);
    navigate(`/student/pay/${pendingChapterId}`);
  }, [pendingChapterId, navigate]);

  const tabs = [
    { key: 'courses', label: t('student:content.tabs.myCourses') },
    { key: 'all', label: t('student:content.tabs.allContent') },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <StudentHero />

      {status !== 'idle' && (
        <PaymentBanner
          status={status}
          chapterId={pendingChapterId}
          onDismiss={dismissBanner}
          onCheckStatus={checkStatus}
          onRetry={handleRetryPayment}
        />
      )}

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(key) => setActiveTab(key as TabKey)} />

      {activeTab === 'all' ? (
        <AllContentTree />
      ) : (
        <MyCoursesTab active={activeTab === 'courses'} showExplore />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline Payment Banner                                              */
/* ------------------------------------------------------------------ */

function PaymentBanner({
  status,
  chapterId,
  onDismiss,
  onCheckStatus,
  onRetry,
}: {
  status: PaymentStatus;
  chapterId: string | null;
  onDismiss: () => void;
  onCheckStatus: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (status === 'confirming') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3">
        <Loader2 size={18} className="shrink-0 animate-spin text-cyan-500" />
        <p className="flex-1 font-cairo text-sm font-medium text-cyan-800">
          {t('student:payment.confirming.title')}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-cyan-400 transition-opacity hover:opacity-70"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3">
        <CheckCircle size={18} className="shrink-0 text-success-500" />
        <p className="flex-1 font-cairo text-sm font-medium text-success-800">
          ✓ {t('student:payment.alreadyEnrolled.title')}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-success-500 transition-opacity hover:opacity-70"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
        <AlertCircle size={18} className="shrink-0 text-danger-500" />
        <p className="flex-1 font-cairo text-sm font-medium text-danger-800">
          {t('student:payment.failedRetry.description')}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {chapterId && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-danger-500 px-3 py-1 font-cairo text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              {t('student:payment.failedRetry.retryButton')}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="text-danger-400 transition-opacity hover:opacity-70"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertCircle size={18} className="shrink-0 text-amber-500" />
        <p className="flex-1 font-cairo text-sm font-medium text-amber-800">
          {t('student:payment.stillProcessing.description')}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onCheckStatus}
            className="rounded-md bg-amber-500 px-3 py-1 font-cairo text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            {t('student:payment.checkStatus')}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-amber-400 transition-opacity hover:opacity-70"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
