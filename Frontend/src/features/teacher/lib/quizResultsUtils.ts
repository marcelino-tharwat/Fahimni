import type { LucideIcon } from 'lucide-react';
import { Star } from 'lucide-react';
import i18n from 'i18next';

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toLocalNum(n: number): string {
  const digits = n.toString().split('');
  if (i18n.language === 'ar') {
    return digits.map((d) => (d === '-' ? '-' : ARABIC_INDIC[parseInt(d, 10)])).join('');
  }
  return digits.join('');
}

export function getGradeBadge(pct: number): { label: string; variant: string; icon: LucideIcon | null } {
  if (pct >= 90) return { label: 'excellent', variant: 'success', icon: Star };
  if (pct >= 75) return { label: 'veryGood', variant: 'cyan', icon: null };
  if (pct >= 60) return { label: 'good', variant: 'info', icon: null };
  if (pct >= 50) return { label: 'acceptable', variant: 'warning', icon: null };
  return { label: 'fail', variant: 'danger', icon: null };
}
