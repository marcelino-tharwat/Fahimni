import { useTabVisibilityBlur } from './useTabVisibilityBlur';
import { cn } from '@/shared/lib/utils/cn';

interface PrivacyBlurOverlayProps {
  className?: string;
}

export function PrivacyBlurOverlay({ className }: PrivacyBlurOverlayProps) {
  const isHidden = useTabVisibilityBlur();

  if (!isHidden) return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 backdrop-blur-sm',
        className,
      )}
      dir="rtl"
      aria-hidden="true"
    >
      <p className="font-cairo text-xl font-semibold text-navy-800">
        تم إخفاء المحتوى مؤقتًا لحمايته
      </p>
    </div>
  );
}
