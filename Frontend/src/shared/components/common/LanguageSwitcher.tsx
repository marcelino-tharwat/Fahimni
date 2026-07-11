import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui';
import { persistLocale } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const currentLang = i18n.language;

  const toggle = () => {
    // i18next is the single source of truth. The `languageChanged` listener in
    // shared/lib/i18n/index.ts keeps <html lang/dir> in sync, and the detector
    // persists the choice to localStorage — no Redux dispatch needed.
    const next = currentLang === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
    if (isAuthenticated) void dispatch(persistLocale({ locale: next }));
  };

  // Label shows the TARGET language (what clicking switches TO).
  const label = currentLang === 'ar' ? 'English' : 'العربية';

  return (
    <Button variant="ghost" size="sm" onClick={toggle}>
      <Languages size={18} />
      <span>{label}</span>
    </Button>
  );
}
