import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { removeToast } from '@/shared/store/slices/toastSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { cn } from '@/shared/lib/utils/cn';
import { Card } from './Card';

const borderClasses: Record<'success' | 'error' | 'warning' | 'info', string> = {
  success: 'border-success',
  error: 'border-danger',
  warning: 'border-warning',
  info: 'border-info',
};

export function Toast() {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((state) => state.toast.toasts);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <Card
          key={toast.id}
          padding="sm"
          className={cn(
            'flex w-full max-w-sm items-center justify-between gap-3 border-s-4',
            borderClasses[toast.type],
          )}
        >
          <span className="font-cairo text-sm text-text-primary">{toast.message}</span>
          <button
            type="button"
            onClick={() => dispatch(removeToast(toast.id))}
            aria-label="close"
            className="shrink-0 text-text-secondary transition-colors hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </Card>
      ))}
    </div>,
    document.body,
  );
}
