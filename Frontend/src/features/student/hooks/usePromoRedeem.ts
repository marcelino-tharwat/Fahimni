import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentPromoApi } from '@/features/student/api/promoCode';
import {
  STUDENT_TREE_KEY,
  STUDENT_MY_COURSES_KEY,
} from '@/features/student/hooks/useStudentContent';
import { STUDENT_ENROLLMENTS_KEY } from '@/features/student/hooks/useStudentProfile';

/**
 * Pre-redeem validation. Always resolves (even for invalid codes) with the
 * `{ valid, reason? }` verdict — see studentPromoApi.validate.
 */
export function useValidatePromo() {
  return useMutation({
    mutationFn: (code: string) => studentPromoApi.validate(code),
  });
}

/**
 * Redeem a promo code against a chapter. On success, invalidates the student
 * content tree, My Courses, and the profile enrollments list so the chapter
 * flips from locked → subscribed and shows up on the profile page once the new
 * PROMO enrollment lands.
 */
export function useRedeemPromo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, chapterId }: { code: string; chapterId: string }) =>
      studentPromoApi.redeem(code, chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STUDENT_MY_COURSES_KEY });
      queryClient.invalidateQueries({ queryKey: STUDENT_ENROLLMENTS_KEY });
    },
  });
}
