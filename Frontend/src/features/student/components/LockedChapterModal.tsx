import { useTranslation } from 'react-i18next';
import { LockKeyhole } from 'lucide-react';
import { Modal } from '@/shared/components/ui';
import type { StudentChapterNode } from '@/features/student/types/studentContent';

interface LockedChapterModalProps {
  chapter: StudentChapterNode | null;
  onClose: () => void;
  onSubscribe: (chapter: StudentChapterNode) => void;
}

/**
 * Locked-chapter dialog shown when a student interacts with a paid chapter they
 * are not enrolled in. Built on the shared Modal (portal, overlay-click close,
 * Escape, focus trap, X button).
 */
export function LockedChapterModal({ chapter, onClose, onSubscribe }: LockedChapterModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={chapter !== null} onClose={onClose} size="sm">
      {chapter && (
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
              {t('student:content.badges.price', { price: chapter.price })}
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
    </Modal>
  );
}
