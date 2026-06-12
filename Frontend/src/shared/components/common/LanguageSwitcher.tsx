import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggle = () => {
    // i18next is the single source of truth. The `languageChanged` listener in
    // shared/lib/i18n/index.ts keeps <html lang/dir> in sync, and the detector
    // persists the choice to localStorage — no Redux dispatch needed.
    i18n.changeLanguage(currentLang === 'ar' ? 'en' : 'ar');
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
