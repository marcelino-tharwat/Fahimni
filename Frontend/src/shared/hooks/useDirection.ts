import { useAppSelector } from '@/shared/store/hooks';

export function useDirection() {
  return useAppSelector((state) => state.ui.direction);
}
