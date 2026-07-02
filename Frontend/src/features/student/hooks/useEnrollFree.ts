import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enrollFree } from '@/features/student/api/enrollment';
import {
  STUDENT_TREE_KEY,
  STUDENT_MY_COURSES_KEY,
} from '@/features/student/hooks/useStudentContent';
import { STUDENT_ENROLLMENTS_KEY } from '@/features/student/hooks/useStudentProfile';

/**
 * Enroll the student in a free chapter. On success, invalidates the student
 * content tree, My Courses, and the profile enrollments list so the chapter
 * flips from free → subscribed and shows up on the profile page once the new
 * FREE enrollment lands. Mirrors useRedeemPromo's invalidation set exactly.
 */
export function useEnrollFree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chapterId: string) => enrollFree(chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STUDENT_MY_COURSES_KEY });
      queryClient.invalidateQueries({ queryKey: STUDENT_ENROLLMENTS_KEY });
    },
  });
}
