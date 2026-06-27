import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentIndexingApi } from '@/features/teacher/api/contentIndexing';

export const indexStatusKey = (lessonId: string) => ['teacher', 'indexStatus', lessonId] as const;

/** Live indexing status for a single lesson (only fetched while `enabled`). */
export function useIndexStatus(lessonId: string, enabled: boolean) {
  return useQuery({
    queryKey: indexStatusKey(lessonId),
    queryFn: () => contentIndexingApi.getStatus(lessonId),
    enabled: enabled && Boolean(lessonId),
  });
}

/** Index a lesson's text; refreshes that lesson's status on success. */
export function useIndexLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lessonId: string; pdfText: string }) =>
      contentIndexingApi.indexLesson(vars.lessonId, vars.pdfText),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: indexStatusKey(vars.lessonId) }),
  });
}
