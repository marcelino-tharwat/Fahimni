import { Ticket, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/shared/components/ui/Modal';

export interface GenerateConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function GenerateConfirmModal({
  isOpen,
  onConfirm,
  onClose,
  isLoading,
}: GenerateConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col items-center gap-5 pt-2 text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-cyan-gradient text-white shadow-[0_0_32px_rgba(0,201,219,0.3)]">
          <Ticket size={32} />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-navy-800">{t('promoCodes.confirmTitle')}</h3>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
            {t('promoCodes.confirmDesc')}
          </p>
          <p className="mt-1.5 text-xs text-gray-500">{t('promoCodes.confirmValidity')}</p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-gradient text-sm font-semibold text-white shadow-glow transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {t('promoCodes.creating')}
              </>
            ) : (
              <>
                <Plus size={16} />
                {t('promoCodes.confirmButton')}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-full rounded-xl text-sm font-medium text-gray-600 transition-all hover:opacity-75"
          >
            {t('promoCodes.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
