import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/shared/components/ui';
import type { NodeType } from './types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  itemName: string;
  itemType: NodeType;
  hasChildren: boolean;
  childrenCount: number;
  loading?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  itemName,
  itemType,
  hasChildren,
  childrenCount,
  loading = false,
}: DeleteConfirmModalProps) {
  const { t } = useTranslation('teacher');

  const warning = (): string => {
    if (itemType === 'stage') {
      return hasChildren
        ? t('contentTree.delete.stageWithChildren', { count: childrenCount })
        : t('contentTree.delete.stageEmpty');
    }
    if (itemType === 'chapter') {
      return hasChildren
        ? t('contentTree.delete.chapterWithChildren', { count: childrenCount })
        : t('contentTree.delete.chapterEmpty');
    }
    return t('contentTree.delete.lesson');
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={t('contentTree.delete.title')} size="sm">
      <p className="mb-2 font-cairo text-base font-bold text-navy-800">{itemName}</p>
      <p className="font-cairo text-sm text-gray-500">{warning()}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="min-w-[120px] rounded-btn border border-gray-300 bg-white px-6 py-2.5 font-cairo text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {t('actions.cancel', { ns: 'common' })}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-btn bg-danger-600 px-6 py-2.5 font-cairo text-sm font-medium text-white transition-colors hover:bg-danger-600/90 disabled:opacity-50"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {t('actions.delete', { ns: 'common' })}
        </button>
      </div>
    </Modal>
  );
}
