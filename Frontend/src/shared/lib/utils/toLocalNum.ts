import i18n from 'i18next';

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toLocalNum(n: number): string {
  const digits = n.toString().split('');
  if (i18n.language === 'ar') {
    return digits.map((d) => (d === '-' ? '-' : ARABIC_INDIC[parseInt(d, 10)])).join('');
  }
  return digits.join('');
}
