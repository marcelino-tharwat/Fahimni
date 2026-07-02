import { cn } from '@/shared/lib/utils/cn';

export const ESSAY_GRADING_CYAN = 'linear-gradient(135deg,#00C9DB,#0EA5E9)';
export const ESSAY_GRADING_NAVY = 'linear-gradient(135deg,#251758,#0F0A2B)';
export const ESSAY_CARD_SHADOW = '0 2px 12px rgba(0,0,0,0.06)';

export function essayRowClass(hovered: boolean) {
  return cn(
    'cursor-pointer overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white transition-all duration-150',
    hovered && 'shadow-[0_4px_16px_rgba(0,0,0,0.10)]',
  );
}
