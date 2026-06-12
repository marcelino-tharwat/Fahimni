import { useTranslation } from 'react-i18next';

/**
 * Returns the current layout direction, derived from i18next (the single
 * source of truth). Re-renders automatically on language change because
 * `useTranslation` subscribes to i18next's `languageChanged` event.
 */
export function useDirection(): 'rtl' | 'ltr' {
  const { i18n } = useTranslation();
  return i18n.language === 'ar' ? 'rtl' : 'ltr';
}
