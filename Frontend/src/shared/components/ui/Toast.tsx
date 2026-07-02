import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { removeToast } from '@/shared/store/slices/toastSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { cn } from '@/shared/lib/utils/cn';
import { Card } from './Card';

type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Per-type icon + colored inline-start accent border (config tokens). */
const TOAST_STYLES: Record<ToastType, { Icon: LucideIcon; accent: string; icon: string }> = {
  success: { Icon: CheckCircle2, accent: 'border-s-success-500', icon: 'text-success-600' },
  error: { Icon: XCircle, accent: 'border-s-danger-500', icon: 'text-danger-600' },
  warning: { Icon: AlertTriangle, accent: 'border-s-warning-500', icon: 'text-warning-600' },
  info: { Icon: Info, accent: 'border-s-purple-500', icon: 'text-purple-500' },
};

export function Toast() {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((state) => state.toast.toasts);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        const Icon = style.Icon;
        return (
          <Card
            key={toast.id}
            padding="sm"
            className={cn(
              'flex w-full max-w-sm items-start gap-3 border border-gray-100 border-s-4 bg-surface shadow-lg',
              style.accent,
            )}
          >
            <Icon size={20} className={cn('mt-0.5 shrink-0', style.icon)} />
            <span className="flex-1 font-cairo text-sm text-text-primary">{toast.message}</span>
            <button
              type="button"
              onClick={() => dispatch(removeToast(toast.id))}
              aria-label="close"
              className="mt-0.5 shrink-0 text-text-secondary transition-colors hover:text-text-primary"
            >
              <X size={16} />
            </button>
          </Card>
        );
      })}
    </div>,
    document.body,
  );
}
