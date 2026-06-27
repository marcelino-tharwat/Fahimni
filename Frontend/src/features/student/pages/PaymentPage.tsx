import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Ticket } from 'lucide-react';
import { Button, Card, Input } from '@/shared/components/ui';
import { addToast } from '@/shared/store/slices/toastSlice';
import { useAppDispatch } from '@/shared/store/hooks';
import { mockChapters } from '@/shared/mocks/content';
import { formatEGP } from '@/shared/lib/utils/formatCurrency';

const chapter = mockChapters.find((item) => !item.isUnlocked) ?? mockChapters[0]!;

export function PaymentPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [promoCode, setPromoCode] = useState('');

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">
        {t('student:payment.title', { chapter: chapter.name })}
      </h1>

      {/* Chapter info */}
      <Card padding="lg" className="flex items-center justify-between gap-4">
        <span className="font-cairo text-base font-semibold text-text-primary">{chapter.name}</span>
        <span className="font-cairo text-xl font-bold text-accent">{formatEGP(chapter.price)}</span>
      </Card>

      {/* Pay with card */}
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <CreditCard size={22} className="text-accent" />
          <h2 className="font-cairo text-base font-semibold text-text-primary">
            {t('student:payment.payWithCard')}
          </h2>
        </div>
        <Button onClick={() => dispatch(addToast({ type: 'info', message: 'جارٍ تحويلك لبوابة الدفع...' }))}>
          {t('student:payment.payWithCard')}
        </Button>
      </Card>

      {/* Promo code */}
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Ticket size={22} className="text-accent" />
          <h2 className="font-cairo text-base font-semibold text-text-primary">
            {t('student:payment.usePromoCode')}
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
          <Input
            className="w-full sm:flex-1"
            placeholder={t('student:payment.enterCode')}
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => dispatch(addToast({ type: 'success', message: t('student:payment.success') }))}
          >
            {t('student:payment.apply')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
