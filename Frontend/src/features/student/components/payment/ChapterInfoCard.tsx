import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import type { ChapterData } from './types';

interface ChapterInfoCardProps {
  chapter: ChapterData;
  /** Renders the card at reduced opacity (e.g. while a payment is in flight). */
  dimmed?: boolean;
}

/**
 * Chapter summary card shown at the top of the payment surface. All data is real
 * (from the content tree). Quiz count is intentionally omitted — the student
 * tree exposes `lessonCount` only, so we don't fabricate a quiz stat.
 */
export function ChapterInfoCard({ chapter, dimmed = false }: ChapterInfoCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US';

  const priceLabel =
    chapter.price != null
      ? `${chapter.price.toLocaleString(locale)} ${t('student:payment.chapterInfo.currency')}`
      : t('student:payment.promo.free');

  return (
    <div
      className={cn(
        'rounded-card border border-gray-300 bg-white p-6 shadow-card transition-opacity',
        dimmed && 'opacity-65',
      )}
    >
      <span className="inline-flex items-center rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 font-cairo text-[11px] font-semibold text-purple-500">
        {chapter.stageName}
      </span>

      <h2 className="mb-1 mt-2 font-cairo text-xl font-bold text-navy-800">{chapter.name}</h2>
      {chapter.description && (
        <p className="mb-4 font-cairo text-sm leading-relaxed text-gray-600">
          {chapter.description}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-4">
        <span className="flex items-center gap-1.5 font-cairo text-sm text-gray-600">
          <FileText size={14} />
          {t('student:payment.chapterInfo.lessons', {
            count: chapter.lessonCount.toLocaleString(locale),
          })}
        </span>
        <span className="flex items-center gap-1.5 font-cairo text-sm font-medium text-success-500">
          <span aria-hidden>♾️</span>
          {t('student:payment.chapterInfo.lifetime')}
        </span>
      </div>

      <div className="mb-4 h-px bg-gray-300" />

      <div>
        <span className="font-cairo text-4xl font-bold text-cyan-500" dir="ltr">
          {priceLabel}
        </span>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 font-cairo text-[11px] font-semibold text-purple-500">
            {t('student:payment.chapterInfo.lifetimeBadge')}
          </span>
          <span className="text-xs text-gray-500">•</span>
          <span className="font-cairo text-xs text-gray-500">
            {t('student:payment.chapterInfo.oneTime')}
          </span>
        </div>
      </div>
    </div>
  );
}
