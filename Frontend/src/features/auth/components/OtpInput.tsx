import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/utils/cn';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

const DIGIT_COUNT = 6;

export function OtpInput({ value, onChange, error, disabled }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusIndex = (index: number) => {
    const next = inputRefs.current[index];
    if (next) next.focus();
  };

  const handleInput = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '');
    if (!digit) return;

    const chars = value.split('');
    chars[index] = digit;
    const newValue = chars.join('').slice(0, DIGIT_COUNT);
    onChange(newValue);

    if (index < DIGIT_COUNT - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const chars = value.split('');
      if (chars[index]) {
        chars[index] = '';
        onChange(chars.join(''));
      } else if (index > 0) {
        chars[index - 1] = '';
        onChange(chars.join(''));
        focusIndex(index - 1);
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGIT_COUNT);
    if (!pasted) return;
    onChange(pasted);
    const nextIndex = pasted.length < DIGIT_COUNT ? pasted.length : DIGIT_COUNT - 1;
    focusIndex(nextIndex);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-2.5 rtl:flex-row-reverse">
        {Array.from({ length: DIGIT_COUNT }).map((_, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] ?? ''}
            onInput={(e) => handleInput(index, (e.target as HTMLInputElement).value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            aria-label={`Digit ${index + 1}`}
            className={cn(
              'h-12 w-10 rounded-input border text-center font-cairo text-lg font-bold outline-none transition-all duration-200',
              'focus:border-accent focus:ring-2 focus:ring-accent/30',
              error
                ? 'border-danger focus:border-danger focus:ring-danger/30'
                : 'border-border',
              !disabled && !error && 'hover:border-accent/50',
              disabled && 'cursor-not-allowed opacity-50',
              value[index] && 'border-accent/60 bg-accent/[0.03]',
            )}
          />
        ))}
      </div>
      {error && (
        <p className="text-center text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
