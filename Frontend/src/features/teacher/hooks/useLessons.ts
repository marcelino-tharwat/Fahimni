import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lessonsApi } from '@/features/teacher/api/lessons';
import { CONTENT_TREE_KEY } from '@/features/teacher/hooks/useContentTree';
import { TEACHER_DASHBOARD_STATS_KEY } from '@/features/teacher/hooks/useTeacherDashboardStats';
import type {
  CreateLessonPayload,
  UpdateLessonPayload,
} from '@/features/teacher/types/lesson';

const STAGES_KEY = ['teacher', 'stages'];
const LESSONS_KEY = ['teacher', 'lessons'];
const LESSON_KEY = ['teacher', 'lesson'];

export function useLessonsByChapter(chapterId: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, chapterId],
    queryFn: () => lessonsApi.getLessonsByChapter(chapterId!),
    enabled: !!chapterId,
  });
}

export function useLesson(id: string | undefined) {
  return useQuery({
    queryKey: [...LESSON_KEY, id],
    queryFn: () => lessonsApi.getLesson(id!),
    enabled: !!id,
  });
}

export function useCreateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      chapterId,
      payload,
    }: {
      chapterId: string;
      payload: CreateLessonPayload;
    }) => lessonsApi.createLesson(chapterId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LESSONS_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}

export function useUpdateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLessonPayload }) =>
      lessonsApi.updateLesson(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: [...LESSON_KEY, id] });
      queryClient.invalidateQueries({ queryKey: LESSONS_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => lessonsApi.deleteLesson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LESSONS_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}

export function useReorderLessons() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, ids }: { chapterId: string; ids: string[] }) =>
      lessonsApi.reorderLessons(chapterId, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LESSONS_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}
