import { useTranslation } from 'react-i18next';
import { LockKeyhole, GraduationCap, Loader2 } from 'lucide-react';
import { Modal } from '@/shared/components/ui';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import type { StudentChapterNode } from '@/features/student/types/studentContent';

/** Which flavour of the enroll dialog to show. */
export type ChapterEnrollVariant = 'locked' | 'free';

export interface ChapterEnrollTarget {
  chapter: StudentChapterNode;
  variant: ChapterEnrollVariant;
}

interface ChapterEnrollModalProps {
  target: ChapterEnrollTarget | null;
  onClose: () => void;
  /** Locked variant only — navigate to the payment page. */
  onSubscribe: (chapter: StudentChapterNode) => void;
  /** Free variant only — fire the POST /enrollments/free mutation. */
  onConfirmFree: (chapter: StudentChapterNode) => void;
  /** Free variant only — disables the confirm button while the mutation runs. */
  isEnrolling: boolean;
}

/**
 * Chapter enrollment dialog. Two variants share the same shell (portal, overlay
 * click-close, Escape, focus trap, X button — all from the shared Modal):
 *   - 'locked': paid chapter the student hasn't bought → price + "Subscribe Now"
 *     which routes to the payment page (Paymob / promo). Unchanged behavior.
 *   - 'free':  free chapter → confirm dialog that enrolls directly.
 */
export function ChapterEnrollModal({
  target,
  onClose,
  onSubscribe,
  onConfirmFree,
  isEnrolling,
}: ChapterEnrollModalProps) {
  const { t } = useTranslation();

  const chapter = target?.chapter ?? null;
  const variant = target?.variant ?? 'locked';

  return (
    <Modal isOpen={target !== null} onClose={onClose} size="sm">
      {chapter && variant === 'locked' && (
        <div className="flex flex-col items-center gap-3 px-2 pb-1 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
            <LockKeyhole size={28} className="text-purple-600" />
          </span>

          <h2 className="font-cairo text-lg font-bold text-navy-900">
            {t('student:content.lockedModal.title')}
          </h2>
          <p className="max-w-xs font-cairo text-sm text-gray-500">
            {t('student:content.lockedModal.description')}
          </p>

          {chapter.price != null && (
            <p className="font-cairo text-2xl font-extrabold text-purple-600" dir="ltr">
              {t('student:content.badges.price', { price: toLocalNum(chapter.price) })}
            </p>
          )}

          <div className="mt-2 flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => onSubscribe(chapter)}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-button bg-purple-600 px-4 font-cairo text-sm font-semibold text-white transition-colors hover:bg-purple-700"
            >
              {t('student:content.lockedModal.subscribe')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-button border border-gray-300 px-4 font-cairo text-sm font-semibold text-navy-700 transition-colors hover:bg-gray-50"
            >
              {t('student:content.lockedModal.cancel')}
            </button>
          </div>
        </div>
      )}

      {chapter && variant === 'free' && (
        <div className="flex flex-col items-center gap-3 px-2 pb-1 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
            <GraduationCap size={28} className="text-success-600" />
          </span>

          <h2 className="font-cairo text-lg font-bold text-navy-900">
            {t('student:content.freeModal.title')}
          </h2>
          <p className="max-w-xs font-cairo text-sm text-gray-500">
            {t('student:content.freeModal.description')}
          </p>

          <div className="mt-2 flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => onConfirmFree(chapter)}
              disabled={isEnrolling}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-button bg-cyan-500 px-4 font-cairo text-sm font-semibold text-white transition-colors hover:bg-cyan-600 disabled:opacity-60"
            >
              {isEnrolling && <Loader2 size={16} className="animate-spin" />}
              {t('student:content.freeModal.confirm')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isEnrolling}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-button border border-gray-300 px-4 font-cairo text-sm font-semibold text-navy-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {t('student:content.freeModal.cancel')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
