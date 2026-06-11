import { Languages } from 'lucide-react';
import { changeLanguage } from '@/shared/store/slices/uiSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { Button } from '@/shared/components/ui';

export function LanguageSwitcher() {
  const dispatch = useAppDispatch();
  const language = useAppSelector((state) => state.ui.language);

  const nextLanguage = language === 'ar' ? 'en' : 'ar';
  const label = nextLanguage === 'ar' ? 'العربية' : 'English';

  return (
    <Button variant="ghost" size="sm" onClick={() => dispatch(changeLanguage(nextLanguage))}>
      <Languages size={18} />
      <span>{label}</span>
    </Button>
  );
}
