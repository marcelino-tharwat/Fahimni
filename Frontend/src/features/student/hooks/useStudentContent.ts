import { useQuery } from '@tanstack/react-query';
import { studentContentApi } from '@/features/student/api/studentContent';
import { contentApi } from '@/features/student/api/content';
import type { Lesson } from '@/shared/types/content';
import type { ApiError } from '@/shared/lib/api/client';

export const STUDENT_TREE_KEY = ['student', 'content', 'tree'] as const;
export const STUDENT_MY_COURSES_KEY = ['student', 'content', 'my-courses'] as const;

/**
 * All Content tree (stages -> chapters -> lessons) for the authenticated student.
 * `enabled` lets callers fetch lazily (e.g. only when a surface is active); it
 * defaults to true so existing callers keep their current behavior.
 */
export function useStudentTree(enabled = true) {
  return useQuery({
    queryKey: STUDENT_TREE_KEY,
    queryFn: () => studentContentApi.getTree(),
    enabled,
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

/**
 * Fetch a single lesson for the student.
 *
 * NOTE: unlike getTree() (which returns a bare array), this endpoint
 * wraps the response in the standard { success, message, data }
 * envelope, so we must unwrap `data.data` to reach the lesson object.
 */
export function useLesson(lessonId: string) {
  return useQuery({
    queryKey: ['student', 'lesson', lessonId],
    queryFn: async () => {
      const { data } = await contentApi.getLesson(lessonId);
      return data.data as Lesson | undefined;
    },
    enabled: !!lessonId,
    // Don't retry 4xx (e.g. 403 NOT_ENROLLED / 404) — those are terminal, so
    // the enrollment / not-found screen shows immediately. Retry 5xx only.
    retry: (failureCount, error) => {
      const status = (error as ApiError)?.statusCode ?? 0;
      if (status >= 400 && status < 500) return false;
      return failureCount < 3;
    },
  });
}
