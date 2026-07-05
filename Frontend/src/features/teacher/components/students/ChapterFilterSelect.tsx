import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import type { TeacherStudentDetailChapter } from '@/features/teacher/types/studentDetail';

interface ChapterFilterSelectProps {
  chapters: TeacherStudentDetailChapter[];
  /** '' means "all chapters". */
  value: string;
  onChange: (chapterId: string) => void;
}

export function ChapterFilterSelect({ chapters, value, onChange }: ChapterFilterSelectProps) {
  const { t } = useTranslation('teacher');

  return (
    <div className="relative w-full sm:w-48">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('students.detail.chapterFilter.label')}
        className="h-10 w-full cursor-pointer appearance-none rounded-input border border-gray-300 bg-white px-3 pe-9 text-sm text-navy-800 transition-colors focus:border-cyan-500 focus:outline-none"
      >
        <option value="">{t('students.detail.chapterFilter.all')}</option>
        {chapters.map((c) => (
          <option key={c.chapterId} value={c.chapterId}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
