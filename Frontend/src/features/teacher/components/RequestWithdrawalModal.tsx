import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/shared/components/ui';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import {
  createWithdrawalRequestSchema,
  flattenZodErrors,
} from '@/features/teacher/validation';
import { useCreateWithdrawal } from '@/features/teacher/hooks/useTeacherWallet';

interface RequestWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  currency: string;
}

export function RequestWithdrawalModal({
  isOpen,
  onClose,
  availableBalance,
  currency,
}: RequestWithdrawalModalProps) {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const createWithdrawal = useCreateWithdrawal();

  const [amount, setAmount] = useState('');
  const [teacherNote, setTeacherNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) =>
    setErrors((prev) => ({ ...prev, [field]: '' }));

  const handleClose = () => {
    setAmount('');
    setTeacherNote('');
    setErrors({});
    onClose();
  };

  const handleSubmit = () => {
    setErrors({});
    const parsed = createWithdrawalRequestSchema(t, availableBalance).safeParse({
      amount: Number(amount),
      ...(teacherNote !== '' ? { teacherNote } : {}),
    });
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }

    createWithdrawal.mutate(parsed.data, {
      onSuccess: () => {
        dispatch(addToast({ type: 'success', message: t('wallet.withdrawals.requestSaved') }));
        handleClose();
      },
      onError: (error) => {
        dispatch(
          addToast({
            type: 'error',
            message: translateApiError(t, error),
          }),
        );
      },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('wallet.withdrawals.requestModalTitle')}>
      <div className="flex flex-col gap-4">
        <p className="font-cairo text-sm text-text-secondary" data-testid="request-available-hint">
          {t('wallet.withdrawals.availableBalanceHint', {
            amount: Math.round(availableBalance).toLocaleString('ar-EG'),
            currency,
          })}
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="withdrawal-amount" className="font-cairo text-sm font-medium text-text-primary">
            {t('wallet.withdrawals.amount')}
          </label>
          <input
            id="withdrawal-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              clearError('amount');
            }}
            className="w-full rounded-btn border border-border bg-surface p-2 font-cairo text-sm outline-none focus:border-accent"
          />
          {errors.amount && <p className="font-cairo text-xs text-danger">{errors.amount}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="withdrawal-note" className="font-cairo text-sm font-medium text-text-primary">
            {t('wallet.withdrawals.note')}
          </label>
          <textarea
            id="withdrawal-note"
            value={teacherNote}
            onChange={(e) => {
              setTeacherNote(e.target.value);
              clearError('teacherNote');
            }}
            className="min-h-20 w-full rounded-btn border border-border bg-surface p-2 font-cairo text-sm outline-none focus:border-accent"
          />
          {errors.teacherNote && (
            <p className="font-cairo text-xs text-danger">{errors.teacherNote}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} type="button">
            {t('wallet.payoutProfile.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={createWithdrawal.isPending} type="button">
            {createWithdrawal.isPending
              ? t('wallet.withdrawals.submitting')
              : t('wallet.withdrawals.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
