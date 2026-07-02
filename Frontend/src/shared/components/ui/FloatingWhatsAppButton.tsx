import { FaWhatsapp } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/shared/store/hooks';

const PHONE = import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER;

if (import.meta.env.DEV && !PHONE) {
  console.warn(
    '[FloatingWhatsAppButton] VITE_WHATSAPP_SUPPORT_NUMBER is not set — button will not render.',
  );
}

const styles = `
@media (hover: hover) {
  .wa-btn:hover {
    background-color: #128C7E;
  }
  .wa-btn:active {
    background-color: #075E54;
  }
  .wa-tooltip {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .wa-group:hover .wa-tooltip {
    opacity: 1;
    transition-delay: 200ms;
  }
}
`;

export function FloatingWhatsAppButton() {
  const { t, i18n } = useTranslation('student');
  const user = useAppSelector((s) => s.auth.user);

  if (!PHONE || user?.role !== 'STUDENT') return null;

  const isRtl = i18n.dir() === 'rtl';
  const name = user?.fullName ?? '';
  const email = user?.email ?? '';

  const fallback = t('support.whatsapp.fallbackName');
  const message = t('support.whatsapp.messageTemplate', {
    name: name || fallback,
    email: email || '—',
  });

  const waUrl = `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;

  return (
    <div className={`wa-group fixed bottom-6 z-[199] ${isRtl ? 'left-6' : 'right-6'}`}>
      <style>{styles}</style>

      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('support.whatsapp.ariaLabel')}
        className={[
          'wa-btn flex size-14 items-center justify-center rounded-full',
          'bg-whatsapp text-white shadow-lg',
          'motion-safe:animate-float',
          'hover:[animation-play-state:paused]',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-whatsapp-light',
          'transition-shadow duration-200',
        ].join(' ')}
      >
        <FaWhatsapp size={28} />
      </a>

      <span className={`wa-tooltip pointer-events-none absolute bottom-full mb-3 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white shadow-md ${isRtl ? 'left-0' : 'right-0'}`}>
        {t('support.whatsapp.tooltip')}
      </span>
    </div>
  );
}
