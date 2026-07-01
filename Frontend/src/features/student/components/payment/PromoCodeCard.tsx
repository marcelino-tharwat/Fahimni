import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ticket, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { useValidatePromo, useRedeemPromo } from '@/features/student/hooks/usePromoRedeem';
import type { RedeemResult } from '@/shared/types';

type PromoState =
  | 'default'
  | 'validating'
  | 'valid'
  | 'error-used'
  | 'error-expired'
  | 'error-invalid'
  | 'error-not-for-chapter';

/** i18n key per error state — mirrors the backend reasons. */
const ERROR_KEY: Record<string, string> = {
  'error-used': 'student:payment.promo.errorUsed',
  'error-expired': 'student:payment.promo.errorExpired',
  'error-invalid': 'student:payment.promo.errorInvalid',
  'error-not-for-chapter': 'student:payment.promo.errorNotForChapter',
};

const PROMO_CODE_LENGTH = 8;

interface PromoCodeCardProps {
  chapterId: string;
  onSuccess: (result: RedeemResult) => void;
}

/** Maps a validate() verdict reason to the matching error state. */
function reasonToState(reason?: string): PromoState {
  switch (reason) {
    case 'CODE_ALREADY_USED':
      return 'error-used';
    case 'CODE_EXPIRED':
      return 'error-expired';
    case 'CODE_NOT_FOR_THIS_CHAPTER':
      return 'error-not-for-chapter';
    case 'CODE_NOT_FOUND':
    default:
      return 'error-invalid';
  }
}

/** Best-effort mapping of a redeem 400 (race after validate) to an error state. */
function redeemErrorToState(error: unknown): PromoState {
  const message = extractApiMessage(error).toLowerCase();
  if (message.includes('used')) return 'error-used';
  if (message.includes('expired')) return 'error-expired';
  return 'error-invalid';
}

function extractApiMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

/**
 * Promo-code redemption card. Drives the full real flow:
 *   validate (POST /promo-codes/:code/validate) → redeem (POST /promo-codes/redeem).
 * On redeem success it shows the success banner and, after 2s, hands the result
 * to `onSuccess` (the page navigates into the now-unlocked course).
 */
export function PromoCodeCard({ chapterId, onSuccess }: PromoCodeCardProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<PromoState>('default');
  const [code, setCode] = useState('');
  const validateMutation = useValidatePromo();
  const redeemMutation = useRedeemPromo();

  const isValid = state === 'valid';
  const isChecking = state === 'validating';
  const isError = state.startsWith('error');

  // Empty-on-submit gets its own message; a wrong/rejected code uses errorInvalid.
  const errorKey =
    state === 'error-invalid' && code.trim() === ''
      ? 'student:payment.promo.errorEmpty'
      : ERROR_KEY[state];

  const handleApply = () => {
    const cleaned = code.trim().toUpperCase();
    // Client-side guard — don't hit the API for an obviously malformed code.
    if (cleaned.length !== PROMO_CODE_LENGTH) {
      setState('error-invalid');
      return;
    }

    setState('validating');
    validateMutation.mutate({ code: cleaned, chapterId }, {
      onSuccess: (result) => {
        if (!result.valid) {
          setState(reasonToState(result.reason));
          return;
        }
        redeemMutation.mutate(
          { code: cleaned, chapterId },
          {
            onSuccess: (redeemResult) => {
              setState('valid');
              window.setTimeout(() => onSuccess(redeemResult), 2000);
            },
            onError: (error) => setState(redeemErrorToState(error)),
          },
        );
      },
      onError: () => setState('error-invalid'),
    });
  };

  const handleChange = (value: string) => {
    setCode(value.toUpperCase());
    // Clear a stale error the moment the student edits the code again.
    if (isError) setState('default');
  };

  return (
    <div
      className={cn(
        'flex h-full flex-col items-center gap-4 rounded-card border-2 p-5 transition-all duration-200',
        isValid
          ? 'border-success-500 bg-success-500/5 shadow-[0_4px_20px_rgba(16,185,129,0.12)]'
          : 'border-gray-300 bg-white shadow-card hover:border-cyan-500/50 hover:shadow-[0_4px_20px_rgba(0,201,219,0.12)]',
      )}
    >
      {/* icon */}
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-2xl text-white',
          isValid
            ? 'bg-[linear-gradient(135deg,#10B981,#059669)] shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            : 'bg-purple-gradient shadow-[0_0_20px_rgba(124,58,237,0.3)]',
        )}
      >
        {isValid ? <CheckCircle size={24} /> : <Ticket size={24} />}
      </div>

      <div className="flex-1 text-center">
        <p className="mb-1 font-cairo text-base font-semibold text-navy-800">
          {t('student:payment.promo.title')}
        </p>
        <p className="font-cairo text-xs leading-relaxed text-gray-500">
          {t('student:payment.promo.subtitle')}
        </p>
      </div>

      <span className="inline-flex items-center rounded-full border border-success-500/30 bg-success-50 px-2.5 py-0.5 font-cairo text-[11px] font-semibold text-success-500">
        {t('student:payment.promo.free')}
      </span>

      {!isValid ? (
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={code}
                onChange={(event) => handleChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleApply();
                }}
                placeholder={t('student:payment.promo.placeholder')}
                dir="ltr"
                maxLength={PROMO_CODE_LENGTH}
                disabled={isChecking}
                aria-invalid={isError}
                className={cn(
                  'h-12 w-full rounded-input border-2 pe-3 ps-9 text-center font-cairo text-base font-bold tracking-[0.14em] text-navy-800 outline-none transition-colors disabled:opacity-70',
                  isError
                    ? 'border-danger-500 bg-danger-50 ring-2 ring-danger-500/20'
                    : 'border-gray-300 bg-white focus:border-cyan-500',
                )}
              />
              {/* leading status indicator (start side in RTL) */}
              <div className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2">
                {isChecking && <Loader2 size={16} className="animate-spin text-gray-500" />}
                {isError && <XCircle size={16} className="text-danger-500" />}
              </div>
            </div>
            <button
              type="button"
              onClick={handleApply}
              disabled={isChecking}
              className="h-12 shrink-0 rounded-input bg-cyan-gradient px-4 font-cairo text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {t('student:payment.promo.apply')}
            </button>
          </div>

          {isError && (
            <p className="font-cairo text-xs font-medium text-danger-500">✗ {t(errorKey)}</p>
          )}
          {isChecking && (
            <p className="font-cairo text-xs text-gray-500">
              {t('student:payment.promo.validating')}
            </p>
          )}
        </div>
      ) : (
        <div className="flex w-full items-center gap-2.5 rounded-xl border border-success-500/30 bg-success-50 px-4 py-3">
          <CheckCircle size={18} className="shrink-0 text-success-500" />
          <div>
            <p className="font-cairo text-sm font-bold text-success-600">
              ✓ {t('student:payment.promo.successTitle')}
            </p>
            <p className="font-cairo text-xs text-success-500">
              {t('student:payment.promo.successRedirect')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
