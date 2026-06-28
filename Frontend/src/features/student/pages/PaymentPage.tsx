import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { useStudentTree } from '@/features/student/hooks/useStudentContent';
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

/** Locate a chapter in the content tree and flatten it into ChapterData. */
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

  // Freeze the "already enrolled" verdict from the FIRST resolved snapshot. A
  // successful redeem invalidates + refetches the tree (flipping this chapter to
  // 'purchased'); without this freeze the page would swap to AlreadyEnrolledView
  // and rip the success banner out before its 2s navigate fires.
  const enrolledOnLoad = useRef<boolean | null>(null);

  const chapter = data && chapterId ? findChapter(data, chapterId) : null;
  if (chapter && enrolledOnLoad.current === null) {
    enrolledOnLoad.current = chapter.enrollmentStatus === 'purchased';
  }

  const goToCourse = () => {
    if (chapter?.firstLessonId) navigate(`/student/lessons/${chapter.firstLessonId}`);
    else navigate('/student/content');
  };

  if (isLoading) return <PaymentLoading />;
  if (isError) return <PaymentError onRetry={() => refetch()} retrying={isFetching} />;
  if (!chapter) return <ChapterNotFound onBack={() => navigate('/student/content')} />;

  if (enrolledOnLoad.current) {
    return <AlreadyEnrolledView chapter={chapter} onGoToCourse={goToCourse} />;
  }

  const handleSuccess = (_result: RedeemResult) => {
    dispatch(addToast({ type: 'success', message: t('student:payment.successToast') }));
    goToCourse();
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      {/* back */}
      <button
        type="button"
        onClick={() => navigate('/student/content')}
        className="flex w-fit items-center gap-1.5 font-cairo text-sm text-gray-600 transition-opacity hover:opacity-70"
      >
        <ChevronRight size={14} />
        {t('student:payment.backToContent')}
      </button>

      <ChapterInfoCard chapter={chapter} />

      <div>
        <p className="mb-3 font-cairo text-base font-semibold text-navy-800">
          {t('student:payment.chooseMethod')}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PaymobCard price={chapter.price} />
          <PromoCodeCard chapterId={chapter.id} onSuccess={handleSuccess} />
        </div>
      </div>

      <SecureFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  States                                                              */
/* ------------------------------------------------------------------ */

function PaymentLoading() {
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
