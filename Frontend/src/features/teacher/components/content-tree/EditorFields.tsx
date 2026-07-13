import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';

/**
 * Small presentational field helpers shared by the three editor forms, so each
 * form file stays focused on its own state/validation rather than markup.
 */

/** Shared input/textarea box classes, with the cyan focus ring + red error state. */
function fieldClasses(hasError: boolean): string {
  return cn(
    'w-full rounded-lg border bg-surface px-4 py-3 font-cairo text-base text-navy-800 outline-none transition-colors placeholder:text-gray-400',
    hasError
      ? 'border-danger-500 focus:border-danger-500 focus:ring-1 focus:ring-danger-500'
      : 'border-gray-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500',
  );
}

function FieldLabel({
  label,
  required,
  optional,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
  const { t } = useTranslation('teacher');
  return (
    <label className="mb-1.5 block font-cairo text-sm font-medium text-gray-700">
      {label}
      {required && <span className="text-danger-500"> *</span>}
      {optional && (
        <span className="font-normal text-gray-400"> ({t('contentTree.editor.optional')})</span>
      )}
    </label>
  );
}

interface LabeledInputProps {
  label: string;
  required?: boolean;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  type?: string;
  trailing?: ReactNode;
  maxLength?: number;
  dir?: 'ltr' | 'rtl';
  inputMode?: 'numeric' | 'text';
  placeholder?: string;
  disabled?: boolean;
}

export function LabeledInput({
  label,
  required,
  optional,
  value,
  onChange,
  error,
  helperText,
  type = 'text',
  trailing,
  maxLength,
  dir,
  inputMode,
  placeholder,
  disabled,
}: LabeledInputProps) {
  return (
    <div>
      <FieldLabel label={label} required={required} optional={optional} />
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          dir={dir}
          inputMode={inputMode}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={cn(fieldClasses(Boolean(error)), trailing && 'pe-14', disabled && 'cursor-not-allowed bg-gray-50 text-gray-500')}
        />
        {trailing && (
          <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
            {trailing}
          </div>
        )}
      </div>
      {error ? (
        <p className="mt-1 font-cairo text-sm text-danger-500">{error}</p>
      ) : (
        helperText && <p className="mt-1 font-cairo text-sm text-gray-400">{helperText}</p>
      )}
    </div>
  );
}

interface LabeledTextareaProps {
  label: string;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  maxLength?: number;
  rows?: number;
}

export function LabeledTextarea({
  label,
  optional,
  value,
  onChange,
  error,
  maxLength = 2000,
  rows = 4,
}: LabeledTextareaProps) {
  return (
    <div>
      <FieldLabel label={label} optional={optional} />
      <textarea
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        className={cn(fieldClasses(Boolean(error)), 'min-h-[120px] resize-y')}
      />
      <div className="flex justify-between gap-2">
        <span className="mt-1 font-cairo text-sm text-danger-500">{error ?? ''}</span>
        <span className="mt-1 shrink-0 font-cairo text-xs text-gray-400">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}

interface FormActionsProps {
  onCancel: () => void;
  saving: boolean;
  /** Idle submit label. Defaults to "Save Changes". */
  submitLabel?: string;
  /** Busy submit label. Defaults to "Saving...". */
  submittingLabel?: string;
}

/** Cancel (ghost) + submit (solid cyan, save icon / spinner while busy). */
export function FormActions({
  onCancel,
  saving,
  submitLabel,
  submittingLabel,
}: FormActionsProps) {
  const { t } = useTranslation();
  const idleLabel = submitLabel ?? t('teacher:contentTree.editor.save');
  const busyLabel = submittingLabel ?? t('teacher:contentTree.editor.saving');
  return (
    <div className="mt-8 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="w-full min-w-[120px] rounded-lg border border-gray-300 bg-surface px-6 py-2.5 font-cairo text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
      >
        {t('actions.cancel')}
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex w-full min-w-[120px] items-center justify-center gap-2 rounded-lg bg-cyan-500 px-6 py-2.5 font-cairo text-sm font-medium text-white transition-colors hover:bg-cyan-600 disabled:opacity-50 sm:w-auto"
      >
        {saving ? busyLabel : idleLabel}
        {saving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Save size={16} />
        )}
      </button>
    </div>
  );
}
