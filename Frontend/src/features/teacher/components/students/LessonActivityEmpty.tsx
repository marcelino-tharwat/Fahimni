import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';

export function LessonActivityEmpty() {
  const { t } = useTranslation('teacher');

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <BookOpen className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-h3 text-navy-800">{t('students.detail.empty.title')}</h3>
      <p className="max-w-md text-body text-gray-600">{t('students.detail.empty.description')}</p>
    </div>
  );
}
