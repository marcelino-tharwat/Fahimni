import { useTranslation } from 'react-i18next';
import { FolderTree, Plus } from 'lucide-react';

interface ContentTreeEmptyStateProps {
  onAddChapter: () => void;
}

export function ContentTreeEmptyState({ onAddChapter }: ContentTreeEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <FolderTree size={40} className="text-gray-300" />
      <p className="font-cairo text-sm text-gray-500">{t('teacher:contentTree.empty')}</p>
      <button
        type="button"
        onClick={onAddChapter}
        className="mt-1 flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 font-cairo text-sm font-medium text-white transition-colors hover:bg-cyan-600"
      >
        <Plus size={16} />
        {t('teacher:contentTree.addChapter')}
      </button>
    </div>
  );
}
