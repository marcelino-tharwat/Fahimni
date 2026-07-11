import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Loader2 } from 'lucide-react';
import { paymentApi } from '@/features/student/api/payment';
import { translateApiError } from '@/shared/lib/api/translateError';

const PAYMENT_LOGOS = ['VISA', 'MC', 'MEEZA', 'VF Cash', 'FAWRY'];

const PENDING_STORAGE_KEY = 'pending_payment';

interface PaymobCardProps {
  price: number | null;
  chapterId: string;
}

export function PaymobCard({ price, chapterId }: PaymobCardProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US';

  const priceLabel =
    price != null
      ? `${price.toLocaleString(locale)} ${t('student:payment.chapterInfo.currency')}`
      : t('student:payment.promo.free');

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: res } = await paymentApi.checkout(chapterId);
      const { iframeUrl, orderId } = res.data;

      sessionStorage.setItem(
        PENDING_STORAGE_KEY,
        JSON.stringify({ orderId, chapterId, startedAt: Date.now() }),
      );

      window.location.href = iframeUrl;
    } catch (err: unknown) {
      setError(translateApiError(t, err));
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center gap-4 rounded-card border-2 border-gray-300 bg-white p-5 shadow-card transition-all duration-200 hover:border-cyan-500/50 hover:shadow-[0_4px_20px_rgba(0,201,219,0.12)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-gradient text-white shadow-[0_0_20px_rgba(0,201,219,0.3)]">
        <CreditCard size={24} />
      </div>

      <div className="flex-1 text-center">
        <p className="mb-1 font-cairo text-base font-semibold text-navy-800">
          {t('student:payment.paymob.title')}
        </p>
        <p className="font-cairo text-xs leading-relaxed text-gray-500">
          {t('student:payment.paymob.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {PAYMENT_LOGOS.map((logo) => (
          <span
            key={logo}
            className="rounded-lg bg-gray-200 px-2 py-1 font-cairo text-[9px] font-bold text-gray-500"
          >
            {logo}
          </span>
        ))}
      </div>

      <p className="font-cairo text-lg font-bold text-cyan-500" dir="ltr">
        {priceLabel}
      </p>

      {error && (
        <p className="font-cairo text-xs font-medium text-danger-500">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-input bg-cyan-gradient font-cairo text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(0,201,219,0.5)] transition-transform active:scale-[0.97] disabled:opacity-60"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : null}
        {loading
          ? t('student:payment.paymob.preparing')
          : t('student:payment.paymob.subscribe')}
      </button>
    </div>
  );
}
