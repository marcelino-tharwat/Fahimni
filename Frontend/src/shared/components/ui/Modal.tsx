import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { Card } from './Card';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn('w-full', sizeClasses[size])}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            {title ? (
              <h2 className="font-cairo text-lg font-semibold text-text-primary">{title}</h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="text-text-secondary transition-colors hover:text-text-primary"
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </Card>
      </div>
    </div>,
    document.body,
  );
}
