import { useQuery } from '@tanstack/react-query';
import { teacherContentApi } from '@/features/teacher/api/content';

/**
 * Shared query key for the content tree. Chapter and lesson mutations import
 * this to invalidate the tree panel so it stays in sync with edits.
 */
export const CONTENT_TREE_KEY = ['teacher', 'contentTree'];

export function useContentTree() {
  return useQuery({
    queryKey: CONTENT_TREE_KEY,
    // getContentTree already guards against the diagnostics object and returns
    // an empty array when there is no content.
    queryFn: () => teacherContentApi.getContentTree(),
  });
}
