import { useTranslation } from 'react-i18next';
import { FileText, Award, Clock, AlertCircle } from 'lucide-react';
import type { QuizMeta } from '@/shared/types';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';

interface QuizHeaderCardProps {
  meta: QuizMeta;
}

export function QuizHeaderCard({ meta }: QuizHeaderCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-card border border-gray-300 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-h3 text-navy-800">{meta.title}</h1>
        <span className="rounded-badge border border-purple-100 bg-purple-50 px-2 py-0.5 text-caption font-semibold text-purple-500">
          {meta.chapterLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-1.5 text-body text-gray-600">
          <FileText size={15} />
          <span>{t('quiz:totalQuestions')}: {toLocalNum(meta.totalQuestions)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-body text-gray-600">
          <Award size={15} />
          <span>{t('quiz:totalPoints')}: {toLocalNum(meta.totalPoints)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-body text-gray-600">
          <Clock size={15} />
          <span>{t('quiz:duration')}: {toLocalNum(meta.durationMinutes ?? 30)} {t('common:minutes', { defaultValue: 'دقائق' })}</span>
        </div>
        <div className="flex items-center gap-1.5 text-body text-gray-600">
          <AlertCircle size={15} />
          <span>{t('quiz:attempt')}: {meta.attemptLabel}</span>
        </div>
      </div>
    </div>
  );
}
