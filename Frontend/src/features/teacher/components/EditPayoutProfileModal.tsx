import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/shared/components/ui';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import { createPayoutProfileSchema, flattenZodErrors } from '@/features/teacher/validation';
import { useUpdatePayoutProfile } from '@/features/teacher/hooks/useTeacherWallet';
import type { PayoutProfile, UpdatePayoutProfileInput } from '@/features/teacher/types/wallet';

interface EditPayoutProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: PayoutProfile;
}

export function EditPayoutProfileModal({
  isOpen,
  onClose,
  currentProfile,
}: EditPayoutProfileModalProps) {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const updatePayoutProfile = useUpdatePayoutProfile();

  const [instaPayHandle, setInstaPayHandle] = useState(currentProfile.instaPayHandle ?? '');
  const [vodafoneCashNumber, setVodafoneCashNumber] = useState(
    currentProfile.vodafoneCashNumber ?? '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) =>
    setErrors((prev) => ({ ...prev, [field]: '' }));

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const handleSave = () => {
    setErrors({});

    // Only a field the user has actually typed something into (even
    // whitespace-only) is sent — an untouched blank field means "leave
    // unchanged" and is omitted entirely, matching the backend contract.
    const payload: UpdatePayoutProfileInput = {};
    if (instaPayHandle !== '') payload.instaPayHandle = instaPayHandle;
    if (vodafoneCashNumber !== '') payload.vodafoneCashNumber = vodafoneCashNumber;

    const parsed = createPayoutProfileSchema(t).safeParse(payload);
    if (!parsed.success) {
      setErrors(flattenZodErrors(parsed.error));
      return;
    }

    updatePayoutProfile.mutate(parsed.data, {
      onSuccess: () => {
        dispatch(addToast({ type: 'success', message: t('wallet.payoutProfile.saved') }));
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
    <Modal isOpen={isOpen} onClose={handleClose} title={t('wallet.payoutProfile.modalTitle')}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="instaPayHandle" className="font-cairo text-sm font-medium text-text-primary">
            {t('wallet.payoutProfile.instaPayHandle')}
          </label>
          <input
            id="instaPayHandle"
            type="text"
            value={instaPayHandle}
            onChange={(e) => {
              setInstaPayHandle(e.target.value);
              clearError('instaPayHandle');
            }}
            placeholder={t('wallet.payoutProfile.instaPayPlaceholder')}
            className="w-full rounded-btn border border-border bg-surface p-2 font-cairo text-sm outline-none focus:border-accent"
          />
          {errors.instaPayHandle && (
            <p className="font-cairo text-xs text-danger">{errors.instaPayHandle}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="vodafoneCashNumber"
            className="font-cairo text-sm font-medium text-text-primary"
          >
            {t('wallet.payoutProfile.vodafoneCashNumber')}
          </label>
          <input
            id="vodafoneCashNumber"
            type="text"
            value={vodafoneCashNumber}
            onChange={(e) => {
              setVodafoneCashNumber(e.target.value);
              clearError('vodafoneCashNumber');
            }}
            placeholder={t('wallet.payoutProfile.vodafoneCashPlaceholder')}
            className="w-full rounded-btn border border-border bg-surface p-2 font-cairo text-sm outline-none focus:border-accent"
          />
          {errors.vodafoneCashNumber && (
            <p className="font-cairo text-xs text-danger">{errors.vodafoneCashNumber}</p>
          )}
        </div>

        {errors.root && <p className="font-cairo text-xs text-danger">{errors.root}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} type="button">
            {t('wallet.payoutProfile.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={updatePayoutProfile.isPending} type="button">
            {updatePayoutProfile.isPending
              ? t('wallet.payoutProfile.saving')
              : t('wallet.payoutProfile.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
