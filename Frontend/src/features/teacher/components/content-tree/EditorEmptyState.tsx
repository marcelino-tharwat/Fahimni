import { useTranslation } from 'react-i18next';
import { MousePointerClick } from 'lucide-react';

export function EditorEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
      <MousePointerClick size={40} className="text-gray-300" />
      <p className="font-cairo text-sm text-gray-400">{t('teacher:contentTree.selectItem')}</p>
    </div>
  );
}
