import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';

/** Reassurance footer under the payment options. */
export function SecureFooter() {
  const { t } = useTranslation();

  return (
    <div className="mt-2 flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        <Lock size={12} className="text-gray-500" />
        <p className="font-cairo text-[11px] text-gray-500">{t('student:payment.secure.text')}</p>
      </div>
      <p className="font-cairo text-[10px] text-gray-400">{t('student:payment.secure.powered')}</p>
    </div>
  );
}
