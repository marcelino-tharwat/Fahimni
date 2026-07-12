import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children, size = 'md', initialFocusRef }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Kept up to date every render without being a dependency of the effect
  // below — callers typically pass an inline `() => setOpen(false)`, which is
  // a new function on every render. If it were a dependency, the effect would
  // tear down and re-run on every keystroke inside the modal (e.g. typing in a
  // textarea that updates parent state), which would steal focus away from
  // the field back to the first focusable element (often the close button) —
  // and from there, pressing Space would "click" that button and close the
  // modal. Depending only on `isOpen` keeps the focus/tab-trap setup stable
  // for the entire time the modal is open.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Accessibility: Escape closes, Tab is trapped within the dialog, focus moves
  // into the dialog on open and is restored to the previous element on close.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => !el.hasAttribute('disabled'),
      );

    // If the caller provided an initialFocusRef, focus that element.
    // Otherwise focus the first focusable element (close button).
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else {
      (focusable()[0] ?? dialogRef.current)?.focus();
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        // Allow default Tab behavior inside textareas (insert tab character).
        // Do NOT trap focus when the active element is a textarea.
        if (document.activeElement?.tagName === 'TEXTAREA') return;
        const els = focusable();
        if (els.length === 0) {
          e.preventDefault();
          return;
        }
        const first = els[0]!;
        const last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose is read via onCloseRef, see above.
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    // Full-screen dark overlay; clicking it (outside the card) closes the modal.
    // Uses onCloseRef to avoid passing a new function prop on every parent
    // render (which would cause React to re-attach the event to the portal
    // element on every keystroke, and could trigger focus loss from a
    // controlled textarea inside the modal).
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={() => onCloseRef.current()}
      role="presentation"
    >
      {/* Solid modal card, centered above the overlay. */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          'relative z-[201] w-full rounded-xl bg-white p-6 shadow-xl outline-none',
          sizeClasses[size],
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
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
      </div>
    </div>,
    document.body,
  );
}
