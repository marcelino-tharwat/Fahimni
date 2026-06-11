import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, trailing, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hasError = Boolean(error);

    return (
      <div className="flex w-full flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-start font-cairo text-sm font-medium text-text-primary">
            {label}
          </label>  
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-text-secondary">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={hasError}
            className={cn(
              'h-[48px] w-full rounded-input border bg-surface px-3 font-cairo text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-accent',
              hasError ? 'border-danger focus:border-danger' : 'border-border',
              icon && 'ps-10',
              trailing && 'pe-10',
              className,
            )}
            {...props}
          />
          {trailing && (
            <div className="absolute inset-y-0 end-0 flex items-center pe-3">
              {trailing}
            </div>
          )}
        </div>
        {hasError ? (
          <span className="text-start text-sm text-danger">{error}</span>
        ) : (
          helperText && <span className="text-start text-sm text-text-secondary">{helperText}</span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
