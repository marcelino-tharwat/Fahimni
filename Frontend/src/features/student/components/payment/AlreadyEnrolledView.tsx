import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import { ChapterInfoCard } from './ChapterInfoCard';
import type { ChapterData } from './types';

interface AlreadyEnrolledViewProps {
  chapter: ChapterData;
  onGoToCourse: () => void;
}

/**
 * Shown when a student lands on /student/pay/:chapterId for a chapter they are
 * already enrolled in (`enrollmentStatus === 'purchased'`).
 */
export function AlreadyEnrolledView({ chapter, onGoToCourse }: AlreadyEnrolledViewProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <ChapterInfoCard chapter={chapter} />

      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-cyan-500/30 bg-cyan-500/10">
          <CheckCircle size={36} className="text-cyan-500" />
        </div>
        <div>
          <p className="font-cairo text-lg font-semibold text-navy-800">
            {t('student:payment.alreadyEnrolled.title')}
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
