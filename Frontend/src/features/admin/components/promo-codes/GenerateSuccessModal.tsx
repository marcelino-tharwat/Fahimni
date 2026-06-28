import { useState } from 'react';
import { CheckCircle, Clipboard, ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/shared/components/ui/Modal';
import { cn } from '@/shared/lib/utils/cn';

export interface GenerateSuccessModalProps {
  isOpen: boolean;
  code: string;
  expiresAt: string; // ISO date string
  onClose: () => void;
}

function formatDate(isoDate: string, locale: string): string {
  return new Date(isoDate).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function GenerateSuccessModal({
  isOpen,
  code,
  expiresAt,
  onClose,
}: GenerateSuccessModalProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col items-center gap-5 pt-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#A7F3D0] bg-success-50">
          <CheckCircle size={30} className="text-success-500" />
        </div>

        <h3 className="text-lg font-semibold text-success-500">{t('promoCodes.successTitle')}</h3>

        <div className="flex w-full flex-col items-center gap-2 rounded-card bg-navy-900 px-5 py-5">
          <p className="font-mono text-4xl font-extrabold tracking-[0.25em] text-white">{code}</p>
          <p className="text-xs text-gray-500">
            {t('promoCodes.validUntil', { date: formatDate(expiresAt, locale) })}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-all duration-200',
            copied
              ? 'border-success-500 bg-success-50 text-success-500'
              : 'border-cyan-500 text-cyan-500 hover:bg-cyan-50',
          )}
        >
          {copied ? (
            <>
              <ClipboardCheck size={16} />
              {t('promoCodes.copied')}
            </>
          ) : (
            <>
              <Clipboard size={16} />
              {t('promoCodes.copyCode')}
            </>
          )}
        </button>

        <a
          href={`https://wa.me/?text=${encodeURIComponent('كود التفعيل: ' + code)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex cursor-pointer items-center gap-2 text-xs text-gray-500 transition-colors hover:text-gray-600"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          {t('promoCodes.whatsappHint')}
        </a>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-full rounded-xl text-sm font-medium text-gray-600 transition-all hover:opacity-75"
        >
          {t('promoCodes.close')}
        </button>
      </div>
    </Modal>
  );
}
