import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { FaWhatsapp } from 'react-icons/fa';
import { Check, Loader2 } from 'lucide-react';
import { useUpdateTeacherProfile } from '@/features/teacher/hooks/useTeacherProfile';
import { addToast } from '@/shared/store/slices/toastSlice';
import { useAppDispatch } from '@/shared/store/hooks';
import { normalizeMobile } from '@/features/teacher/validation';
import { translateApiError } from '@/shared/lib/api/translateError';
import { cn } from '@/shared/lib/utils/cn';
import { SkeletonBlock } from './SkeletonBlock';
import type { TeacherProfile } from '@/features/teacher/types/teacher';

const EASTERN = '٠١٢٣٤٥٦٧٨٩';
const WESTERN = '0123456789';
const WHATSAPP_PATTERN = /^01[0-9]{9}$/;

function toWestern(digits: string): string {
  return digits.replace(/[٠-٩]/g, (d) => WESTERN[EASTERN.indexOf(d)]);
}

function toLocalPhone(digits: string): string {
  if (i18n.language !== 'ar') return digits;
  return digits.replace(/[0-9]/g, (d) => EASTERN[parseInt(d, 10)]);
}

interface SupportSettingsCardProps {
  profile: TeacherProfile | null;
  isLoading: boolean;
}

export function SupportSettingsCard({ profile, isLoading }: SupportSettingsCardProps) {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const { mutate: updateProfile, isPending: isSaving } = useUpdateTeacherProfile();

  const [inputValue, setInputValue] = useState('');
  const [savedValue, setSavedValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (profile?.user?.mobile) {
      const normalized = normalizeMobile(profile.user.mobile);
      setInputValue(normalized);
      setSavedValue(normalized);
    }
  }, [profile?.user?.mobile]);

  const isDirty = inputValue !== savedValue;
  const westernDigits = toWestern(inputValue.trim());
  const cleanDigits = westernDigits.replace(/\D/g, '');
  const isEmpty = cleanDigits === '';
  const isValidFormat = WHATSAPP_PATTERN.test(cleanDigits);
  const showValidMark = isDirty && !error && isValidFormat && !isEmpty;
  const hasError = error !== null;
  const isSaveDisabled = !isDirty || isSaving;

  const validate = useCallback((): string | null => {
    if (isEmpty) return t('settings.support.errorRequired');
    if (cleanDigits.length < 10) return t('settings.support.errorTooShort');
    if (!WHATSAPP_PATTERN.test(cleanDigits)) return t('settings.support.errorInvalid');
    return null;
  }, [cleanDigits, isEmpty, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^0-9٠-٩]/g, '');
    setInputValue(cleaned);
    if (error) setError(null);
    if (touched) setTouched(false);
  };

  const handleBlur = () => {
    setTouched(true);
    if (!isEmpty) {
      const validationError = validate();
      if (validationError) setError(validationError);
    } else if (touched || inputValue !== '') {
      setError(t('settings.support.errorRequired'));
    }
  };

  const handleSave = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const normalizedNumber = normalizeMobile(cleanDigits);

    updateProfile(
      { mobile: normalizedNumber },
      {
        onSuccess: () => {
          setSavedValue(normalizedNumber);
          setInputValue(normalizedNumber);
          setError(null);
          setTouched(false);
          dispatch(addToast({ type: 'success', message: t('settings.support.saved') }));
        },
        onError: (err) => {
          dispatch(addToast({
            type: 'error',
            message: translateApiError(t, err),
          }));
        },
      },
    );
  };

  const previewPhone = cleanDigits ? `+20 ${toLocalPhone(cleanDigits)}` : null;
  const displayPlaceholder = i18n.language === 'ar'
    ? '١٠١٢٣٤٥٦٧٨'
    : '1012345678';

  if (isLoading) {
    return (
      <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
        <SkeletonBlock className="mb-3 h-6 w-48" />
        <SkeletonBlock className="mb-6 h-4 w-72" />
        <SkeletonBlock className="mb-2 h-5 w-28" />
        <SkeletonBlock className="mb-6 h-12 w-full" />
        <SkeletonBlock className="mb-4 h-24 w-full" />
        <SkeletonBlock className="h-10 w-28" />
      </div>
    );
  }

  return (
    <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
      <div className="mb-1">
        <h2 className="font-cairo text-h3 text-navy-800">
          {t('settings.support.title')}
        </h2>
        <p className="mt-1 font-cairo text-small text-gray-600">
          {t('settings.support.description')}
        </p>
      </div>

      <div className="mt-5">
        <label className="mb-1.5 block font-cairo text-small font-medium text-gray-700">
          {t('settings.support.label')}
        </label>

        <div className="relative">
          <div className={cn(
              'flex rounded-input border overflow-hidden transition-colors focus-within:ring-1',
              hasError ? 'border-danger-500 focus-within:border-danger-500 focus-within:ring-danger-500/30' :
              showValidMark ? 'border-success-500 focus-within:border-success-500 focus-within:ring-success-500/30' :
              'border-gray-300 focus-within:border-cyan-500 focus-within:ring-cyan-500',
            )}
          >
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={inputValue}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={displayPlaceholder}
              disabled={isSaving}
              className={cn(
                'w-full bg-transparent px-4 py-2.5 font-cairo text-body text-navy-900 outline-none placeholder:text-gray-400 disabled:opacity-65',
                hasError && 'text-danger-500',
                showValidMark && 'text-success-500',
              )}
            />

            <div className="flex items-center border-s border-gray-300 bg-gray-100 px-3">
              <span className="font-cairo text-small text-gray-700" dir="ltr">
                🇪🇬 +20
              </span>
            </div>
          </div>

          {showValidMark && (
            <div className="absolute end-2 top-1/2 -translate-y-1/2 text-success-500">
              <Check size={18} />
            </div>
          )}
        </div>

        {hasError && (
          <p className="mt-1.5 font-cairo text-caption text-danger-500">
            {error}
          </p>
        )}

        <p className="mt-1.5 font-cairo text-caption text-gray-500">
          {t('settings.support.hint')}
        </p>
      </div>

      <div className="mt-5 rounded-card border border-gray-300 bg-gray-50 p-4">
        <p className="font-cairo text-small font-medium text-gray-700">
          {t('settings.support.previewHeading')}
        </p>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-whatsapp-light">
            <FaWhatsapp size={20} className="text-whatsapp" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate font-cairo text-small text-gray-600">
              {t('settings.support.previewBody')}
            </p>
            {previewPhone ? (
              <span className="mt-0.5 truncate font-cairo text-body font-semibold text-navy-800" dir="ltr">
                {previewPhone}
              </span>
            ) : (
              <span className="mt-0.5 truncate font-cairo text-small text-gray-500">
                {t('settings.support.previewEmpty')}
              </span>
            )}
          </div>

          <div className="ms-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-whatsapp shadow-elevated">
            <FaWhatsapp size={24} className="text-white" />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaveDisabled}
          className={cn(
            'flex items-center gap-2 rounded-btn px-6 py-2.5 font-cairo text-body font-semibold text-white transition-colors',
            isSaveDisabled
              ? 'cursor-not-allowed opacity-50'
              : 'bg-accent hover:bg-cyan-400',
          )}
        >
          {isSaving && <Loader2 size={16} className="animate-spin" />}
          {isSaving ? t('settings.support.saving') : t('settings.support.save')}
        </button>

        {isDirty && (
          <span className="rounded-badge bg-warning-500 px-3 py-1 font-cairo text-caption font-medium text-white">
            {t('settings.support.unsavedChanges')}
          </span>
        )}
      </div>
    </div>
  );
}
