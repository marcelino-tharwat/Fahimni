import { useQuery } from '@tanstack/react-query';
import { studentContentApi } from '@/features/student/api/studentContent';

export const STUDENT_TREE_KEY = ['student', 'content', 'tree'] as const;
export const STUDENT_MY_COURSES_KEY = ['student', 'content', 'my-courses'] as const;

/** All Content tree (stages -> chapters -> lessons) for the authenticated student. */
export function useStudentTree() {
  return useQuery({
    queryKey: STUDENT_TREE_KEY,
    queryFn: () => studentContentApi.getTree(),
  });
}

/**
 * The student's enrolled courses. Lazily enabled so it only fetches when the
 * My Courses tab is actually viewed.
 */
export function useMyCourses(enabled = true) {
  return useQuery({
    queryKey: STUDENT_MY_COURSES_KEY,
    queryFn: () => studentContentApi.getMyCourses(),
    enabled,
  });
}
